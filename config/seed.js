import {
  User,
  Pet,
  Veterinarian,
  Groomer,
  PetSitter,
  Product,
  PetListing,
  EmergencyClinic,
  Vaccination,
  Medicine,
  Coupon
} from '../models/index.js';

import {
  seedUsers,
  seedPets,
  seedVets,
  seedGroomers,
  seedSitters,
  seedProducts,
  seedPetListings,
  seedEmergencyClinics,
  seedVaccinations,
  seedMedicines
} from './seedData.js';

/**
 * Seeds reference data into MongoDB.
 *
 * Rules:
 *  - A collection is only populated when it is completely empty, so restarts
 *    and redeploys never duplicate or overwrite live data.
 *  - Seed records use human-readable string ids (e.g. "pet_milo"). Mongo
 *    generates real ObjectIds instead, and the old ids are remapped so that
 *    relationships (ownerId, petId, sellerId) stay intact.
 *  - Demo accounts are only created when SEED_DEMO_DATA=true. Never enable
 *    that in production.
 */

const DEFAULT_COUPONS = [
  { code: 'WELCOME10', discountPercent: 10, maxDiscount: 20, minSpend: 25 },
  { code: 'PETHEALTH20', discountPercent: 20, maxDiscount: 50, minSpend: 50 },
  { code: 'VIPPAW', discountPercent: 15, maxDiscount: 35, minSpend: 40 }
];

// Removes the hand-written string _id so Mongo assigns a real ObjectId.
const withoutId = (doc) => {
  const { _id, ...rest } = doc;
  return rest;
};

const seedCollection = async (Model, docs, label) => {
  const count = await Model.estimatedDocumentCount();
  if (count > 0) {
    console.log(`[Seed] ${label}: ${count} document(s) already present — skipped.`);
    return null;
  }
  const inserted = await Model.insertMany(docs.map(withoutId), { ordered: false });
  console.log(`[Seed] ${label}: inserted ${inserted.length} document(s).`);
  return inserted;
};

// Builds a { legacyStringId -> newObjectIdString } lookup table.
const buildIdMap = (originals, inserted) => {
  const map = new Map();
  if (!inserted) return map;
  originals.forEach((original, i) => {
    if (original._id && inserted[i]) {
      map.set(original._id, inserted[i]._id.toString());
    }
  });
  return map;
};

const seedAdminAccount = async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.log(
      '[Seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — no administrator account was created.'
    );
    return;
  }

  if (password.length < 8) {
    console.warn('[Seed] ADMIN_PASSWORD must be at least 8 characters. Admin account not created.');
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[Seed] Administrator account already exists (${email}).`);
    return;
  }

  // The pre-save hook hashes the password.
  await User.create({
    name: process.env.ADMIN_NAME || 'Administrator',
    email,
    password,
    role: 'admin',
    emailVerified: true
  });
  console.log(`[Seed] Administrator account created for ${email}.`);
};

const seedCoupons = async () => {
  for (const coupon of DEFAULT_COUPONS) {
    await Coupon.updateOne(
      { code: coupon.code },
      { $setOnInsert: { ...coupon, active: true } },
      { upsert: true }
    );
  }
  console.log(`[Seed] Coupons: ${DEFAULT_COUPONS.length} code(s) ensured.`);
};

export const seedDatabase = async () => {
  try {
    // ---- Catalogue data: always safe to seed, contains no personal data ----
    await seedCollection(Veterinarian, seedVets, 'Veterinarians');
    await seedCollection(Groomer, seedGroomers, 'Groomers');
    await seedCollection(PetSitter, seedSitters, 'Pet sitters');
    await seedCollection(Product, seedProducts, 'Products');
    await seedCollection(EmergencyClinic, seedEmergencyClinics, 'Emergency clinics');
    await seedCoupons();

    // ---- Administrator account from environment variables ----
    await seedAdminAccount();

    // ---- Demo/sample data: opt-in only ----
    if (String(process.env.SEED_DEMO_DATA).toLowerCase() !== 'true') {
      console.log('[Seed] SEED_DEMO_DATA is not "true" — demo users, pets and listings skipped.');
      return;
    }

    const demoPassword = process.env.DEMO_PASSWORD || '';
    if (demoPassword.length < 8) {
      console.warn(
        '[Seed] SEED_DEMO_DATA is enabled but DEMO_PASSWORD is missing or shorter than 8 characters. Demo data skipped.'
      );
      return;
    }

    // Users must go through Model.create() so the password hook runs.
    const userCount = await User.estimatedDocumentCount();
    const userIdMap = new Map();

    if (userCount === 0) {
      for (const seedUser of seedUsers) {
        const created = await User.create({
          ...withoutId(seedUser),
          password: demoPassword
        });
        userIdMap.set(seedUser._id, created._id.toString());
      }
      console.log(`[Seed] Demo users: inserted ${seedUsers.length} account(s).`);
    } else {
      // Re-link demo data to the already existing accounts.
      for (const seedUser of seedUsers) {
        const existing = await User.findOne({ email: seedUser.email.toLowerCase() });
        if (existing) userIdMap.set(seedUser._id, existing._id.toString());
      }
      console.log('[Seed] Users already present — demo accounts skipped.');
    }

    const resolveUser = (legacyId) => userIdMap.get(legacyId) || legacyId;

    const insertedPets = await seedCollection(
      Pet,
      seedPets.map((pet) => ({ ...pet, ownerId: resolveUser(pet.ownerId) })),
      'Demo pets'
    );
    const petIdMap = buildIdMap(seedPets, insertedPets);
    const resolvePet = (legacyId) => petIdMap.get(legacyId) || legacyId;

    await seedCollection(
      Vaccination,
      seedVaccinations.map((v) => ({ ...v, petId: resolvePet(v.petId) })),
      'Demo vaccinations'
    );

    await seedCollection(
      Medicine,
      seedMedicines.map((m) => ({ ...m, petId: resolvePet(m.petId) })),
      'Demo medicines'
    );

    await seedCollection(
      PetListing,
      seedPetListings.map((l) => ({ ...l, sellerId: resolveUser(l.sellerId) })),
      'Demo pet listings'
    );

    console.log('[Seed] Demo data seeding complete.');
  } catch (err) {
    // Seeding must never take the API down — log loudly and continue serving.
    console.error('[Seed] Seeding failed:', err.message);
  }
};

export default seedDatabase;
