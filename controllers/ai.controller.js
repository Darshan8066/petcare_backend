import { GoogleGenAI } from '@google/genai';
import { Pet } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Model name is configurable so it can be updated without a code change.
const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 25000;
const MAX_QUERY_LENGTH = 2000;

let aiClient = null;
export const getAIClient = () => {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
};

/**
 * Loads pet context for a prompt, but only when the pet belongs to the caller.
 * Without this check any signed-in user could read another user's pet profile
 * by passing its id to the AI endpoints.
 */
const loadPetContext = async (petId, user) => {
  if (!petId || !user?.userId) return null;
  const pet = await Pet.findById(petId).catch(() => null);
  if (!pet) return null;
  if (user.role !== 'admin' && pet.ownerId !== user.userId) return null;
  return pet;
};

/**
 * AI Veterinary Health Chat & Symptom Triaging
 * POST /api/ai/chat, /api/ai/diagnose, /api/ai/ask
 */
export const handleAIChat = asyncHandler(async (req, res) => {
  {
    const { petId, message, prompt: userPrompt, petContext: incomingContext, symptoms } = req.body;
    const rawQuery = String(userPrompt || message || symptoms || '').trim();

    if (!rawQuery) {
      return res.status(400).json({ success: false, message: 'Message or symptoms description is required.' });
    }

    // Cap the prompt so a very large body cannot drive up model cost.
    const queryText = rawQuery.slice(0, MAX_QUERY_LENGTH);

    let petContext = 'General pet care inquiry.';
    let petName = 'your pet';

    if (incomingContext && typeof incomingContext === 'object') {
      petName = incomingContext.name || 'your pet';
      petContext = `Pet Profile: ${incomingContext.name || 'Pet'}, Species: ${incomingContext.species || 'Dog/Cat'}, Breed: ${incomingContext.breed || 'Companion'}, Weight: ${incomingContext.weight || 5}kg. Known Allergies: ${incomingContext.allergies?.join(', ') || 'None'}.`;
    } else if (petId) {
      const pet = await loadPetContext(petId, req.user);
      if (pet) {
        petName = pet.name;
        petContext = `Pet Profile: ${pet.name}, Species: ${pet.species}, Breed: ${pet.breed}, Weight: ${pet.weight}kg. Known Allergies: ${pet.allergies?.join(', ') || 'None'}.`;
      }
    }

    const client = getAIClient();

    if (client) {
      try {
        const systemPrompt = `You are PetCare+ AI, a kind, caring pet health assistant and triage advisor.
${petContext}

Owner Question / Symptoms: "${queryText}"

CRITICAL RULES:
1. LANGUAGE MATCHING:
   - If the user wrote in Hindi or Hinglish, answer in warm, simple Hindi.
   - If the user wrote in Gujarati, answer in warm, simple Gujarati.
   - If the user wrote in English or any other language, answer in that same language.
2. EASY WORDS ONLY:
   - Use very simple, clear, everyday words that any pet parent can easily understand.
   - Do NOT use hard medical jargon (e.g. say "upset stomach" instead of "gastroenteritis", "skin itch" instead of "dermatitis").
3. STRUCTURE:
   1. Simple Explanation of what might be happening
   2. Easy Home Care steps right now
   3. Warning Signs (when to visit a doctor immediately)
   4. Kind advice on next steps`;

        const geminiPromise = client.models.generateContent({
          model: AI_MODEL,
          contents: systemPrompt
        });

        // 25 second timeout guard for high reliability
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')), AI_TIMEOUT_MS)
        );

        const response = await Promise.race([geminiPromise, timeoutPromise]);

        const reply = response.text || 'I recommend observing your pet closely and scheduling an exam with your vet if symptoms persist.';
        const isUrgent = /emergency|toxic|poison|chocolate|bleeding|seizure|unconscious|choking|fracture|letharg/i.test(queryText);
        
        return res.json({
          success: true,
          data: {
            reply,
            text: reply,
            severity: isUrgent ? 'warning' : 'normal',
            petName
          }
        });
      } catch (err) {
        console.warn('[AI API fallback invoked]:', err.message);
      }
    }

    // Comprehensive clinical veterinary response fallback if GEMINI_API_KEY is not configured or network delay
    const lower = queryText.toLowerCase();
    let reply = `Based on your description for ${petName}, here is our veterinary guidance:

1. **Clinical Assessment**: Changes in behavior, mild gastrointestinal sensitivity, or environmental changes frequently cause mild symptoms in pets.
2. **Immediate Home Care**:
   - Keep ${petName} warm, calm, and resting in a quiet area.
   - Provide constant access to fresh, room-temperature water.
   - For mild stomach upset, a bland diet (boiled chicken breast and white rice, no seasoning) can be offered in small portions.
3. **Red Flags to Watch For**:
   - Repeated vomiting (>2 times in 12 hours) or inability to keep water down.
   - Extreme lethargy or unwillingness to stand.
   - Rapid, shallow, or labored breathing.
   - Discolored gums (pale white, yellow, or deep purple).
4. **Next Steps**: If symptoms don't resolve within 24 hours, or worsen, please schedule a clinical consultation with Dr. Elena Alvarez or your nearest veterinary hospital.`;

    let severity = 'normal';

    if (lower.includes('chocolate') || lower.includes('onion') || lower.includes('garlic') || lower.includes('xylitol') || lower.includes('grape') || lower.includes('poison') || lower.includes('toxic')) {
      severity = 'critical';
      reply = `🚨 **URGENT TOXICITY WARNING FOR ${petName.toUpperCase()}**

Certain common foods and chemicals (dark chocolate, cocoa, grapes/raisins, onions, garlic, xylitol artificial sweetener, and human NSAIDs like Ibuprofen) are dangerously toxic to pets.

**Immediate Steps:**
1. **Do NOT induce vomiting** without professional guidance (caustic substances can cause esophageal burn).
2. **Identify Details**: Note down exactly what was ingested, the quantity, and when it happened.
3. **Contact Emergency Care Immediately**:
   - Call the **ASPCA Animal Poison Control Center**: 1-888-426-4435 (24/7 hotline)
   - Or head directly to our **Emergency SOS** clinic tab for immediate in-person decontamination and supportive care.`;
    } else if (lower.includes('vomit') || lower.includes('diarrhea') || lower.includes('stomach') || lower.includes('poop')) {
      severity = 'warning';
      reply = `**Gastrointestinal Health Guidance for ${petName}**:

1. **Hydration First**: Dehydration is the primary risk with vomiting or diarrhea. Offer small amounts of water or ice cubes every 30 minutes.
2. **Bland Diet Rest**: Fast adult dogs from food for 6–8 hours (do NOT fast puppies or diabetic pets), then introduce a bland diet: 75% boiled white rice and 25% boiled lean chicken breast.
3. **Probiotics**: Consider veterinary-grade probiotics like Purina FortiFlora to stabilize gut flora.
4. **Seek Immediate Vet Care If**: You see blood in stool/vomit, black tarry stools, a distended hard abdomen, or persistent dry heaving (which could indicate GDV/bloat).`;
    } else if (lower.includes('food') || lower.includes('eat') || lower.includes('diet') || lower.includes('nutrition') || lower.includes('kibble')) {
      reply = `**Nutrition & Feeding Guidelines for ${petName}**:

- **Balanced Formula**: Ensure complete nutrition matching life stage (puppy/kitten vs adult vs senior).
- **Gradual Transition**: Always transition foods over 7–10 days (Day 1-3: 25% new food, Day 4-6: 50% new food, Day 7-9: 75% new food) to avoid digestive distress.
- **Portion Control**: Measure portions using a standard measuring cup or gram scale according to their target ideal weight.
- Browse our **Store** tab for veterinarian-vetted formulas and targeted digestive health toppers!`;
    } else if (lower.includes('vaccin') || lower.includes('shot') || lower.includes('deworm')) {
      reply = `**Immunization & Preventative Schedule for ${petName}**:

- **Core Canine Vaccines**: Rabies, DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza).
- **Core Feline Vaccines**: Rabies, FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia).
- **Lifestyle Vaccines**: Bordetella (kennel cough), Leptospirosis, and Lyme disease if visiting parks, daycares, or wooded trails.
- You can inspect ${petName}'s verified vaccination log and set automatic reminder alerts in the **My Pets** section.`;
    } else if (lower.includes('emergency') || lower.includes('seizure') || lower.includes('breath') || lower.includes('unconscious') || lower.includes('hit')) {
      severity = 'critical';
      reply = `🚨 **EMERGENCY ACTION REQUIRED FOR ${petName.toUpperCase()}**

Please activate **Emergency SOS** immediately.
- Keep ${petName} lying flat on a blanket to prevent spinal movement if trauma occurred.
- Check that the airway is clear. Do not put fingers inside their mouth if experiencing seizures.
- Keep them warm and transport them immediately to **Cascade 24/7 Emergency & Critical Care** (1.4 miles away, Phone: 555-911-7387).`;
    }

    return res.json({
      success: true,
      data: {
        reply,
        text: reply,
        severity,
        petName
      }
    });
  }
});

/**
 * AI Live Telehealth Video Consultation Assistant
 * POST /api/ai/video-consultation, /api/ai/video-call
 */
export const handleVideoConsultation = asyncHandler(async (req, res) => {
  {
    const {
      petId,
      message,
      conversationHistory = [],
      petContext: incomingContext,
      doctorName = 'Dr. Elena Alvarez, DVM',
      doctorGender = 'female',
      userName = 'Pet Parent',
      preferredLanguage = 'auto'
    } = req.body;
    const queryText = String(message || '').trim().slice(0, MAX_QUERY_LENGTH);

    // Determine doctor gender if not explicitly passed
    const isDoctorMale = doctorGender === 'male' || /marcus|david|rajesh|michael|alex|john|james/i.test(doctorName);
    const resolvedGender = isDoctorMale ? 'male' : 'female';

    let petName = 'your pet';
    let petDetails = 'Golden Retriever, 31.5kg';

    if (incomingContext && typeof incomingContext === 'object') {
      petName = incomingContext.name || 'your pet';
      petDetails = `${incomingContext.breed || 'Pet'}, ${incomingContext.weight || 5}kg, Allergies: ${incomingContext.allergies?.join(', ') || 'None'}`;
    } else if (petId) {
      const pet = await loadPetContext(petId, req.user);
      if (pet) {
        petName = pet.name;
        petDetails = `${pet.breed}, ${pet.weight}kg, Allergies: ${pet.allergies?.join(', ') || 'None'}`;
      }
    }

    // Detect language from queryText or preferredLanguage (Gujarati, Hindi, Marathi, Tamil, Telugu, Bengali, etc.)
    const isGujarati = /[\u0A80-\u0AFF]/i.test(queryText) || /maro|kutro|biladi|kem|che|mane|nathi|tamaro|tamne/i.test(queryText) || preferredLanguage === 'gu';
    const isHindi = /[\u0900-\u097F]/i.test(queryText) || /mera|meri|kutta|billi|bimar|kya|hai|nahi|dard|ulti|khana|doctor|namaste|pet|khujli|dast/i.test(queryText) || preferredLanguage === 'hi';
    const isMarathi =
      (/[\u0900-\u097F]/i.test(queryText) && /majha|majhi|ahe|nahi|kay|kasa|dog|billi/i.test(queryText)) ||
      preferredLanguage === 'mr';
    const isSpanish = /hola|perro|gato|enfermo|dolor|vomito|gracias/i.test(queryText) || preferredLanguage === 'es';
    
    let detectedLangCode = 'en-US';
    if (isGujarati) detectedLangCode = 'gu-IN';
    else if (isHindi) detectedLangCode = 'hi-IN';
    else if (isMarathi) detectedLangCode = 'mr-IN';
    else if (isSpanish) detectedLangCode = 'es-ES';
    else if (preferredLanguage && preferredLanguage !== 'auto') {
      detectedLangCode = preferredLanguage.includes('-') ? preferredLanguage : `${preferredLanguage}-IN`;
    }

    const client = getAIClient();
    if (client) {
      try {
        // Only the last few turns are replayed to keep the prompt bounded.
        const historyPrompt = (Array.isArray(conversationHistory) ? conversationHistory : [])
          .slice(-12)
          .map((h) => `${h.role === 'user' ? userName : doctorName}: ${String(h.text || '').slice(0, 500)}`)
          .join('\n');
        const prompt = `You are ${doctorName}, a kind, caring pet specialist doctor conducting a live interactive video consultation call with ${userName}, the owner of ${petName} (${petDetails}).
You are speaking directly to ${userName} face-to-face over video.

CRITICAL RULES:
1. LANGUAGE MATCHING:
   - If the user speaks in Hindi (either in Hindi script or Hinglish), respond in warm, natural Hindi so they feel completely at ease.
   - If the user speaks in Gujarati (either in Gujarati script or Gujarati Latin), respond in warm, natural Gujarati.
   - If the user speaks in English, respond in English.
   - Match whatever language the user speaks without ever forcing them to speak English.
2. ULTRA-SIMPLE WORDS (NO HARD JARGON):
   - Use very simple, easy-to-understand, everyday words.
   - NEVER use difficult medical jargon or complicated terminology.
   - For example: say "upset tummy" or "stomach ache" instead of "gastrointestinal enteritis"; say "skin itch or allergy" instead of "allergic dermatitis"; say "throwing up" instead of "emesis".
3. CONVERSATIONAL & CONCISE:
   - Keep your response friendly, reassuring, and concise (2 to 4 simple spoken sentences) so it flows naturally in live conversation.
   - Greet ${userName} by name when appropriate.
4. GENDER: You are a ${resolvedGender} doctor.

Conversation so far:
${historyPrompt || '(Call just started)'}

${userName} just said: "${queryText || 'Hello Doctor, I am here with my pet.'}"

Respond now as ${doctorName}:`;

        const geminiPromise = client.models.generateContent({
          model: AI_MODEL,
          contents: prompt
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')), AI_TIMEOUT_MS)
        );

        const response = await Promise.race([geminiPromise, timeoutPromise]);
        const reply = response.text || (isGujarati
          ? `નમસ્તે ${userName}! હું ${doctorName} છું. હું ${petName} માટે અહીં છું. ચિંતા કરશો નહીં, મને જણાવો શું તકલીફ છે?`
          : isHindi
          ? `नमस्ते ${userName}! मैं ${doctorName} हूँ। मैं ${petName} की मदद के लिए यहाँ हूँ। चिंता मत कीजिए, बताइए क्या परेशानी है?`
          : `Hello ${userName}! I'm ${doctorName}. I can see ${petName} on camera. Please don't worry, tell me what problem ${petName} is having today?`);

        return res.json({
          success: true,
          data: {
            reply,
            spokenText: reply.replace(/[*_#]/g, ''),
            doctorName,
            doctorGender: resolvedGender,
            detectedLanguage: detectedLangCode,
            petName,
            userName
          }
        });
      } catch (err) {
        console.warn('[AI Video Consult fallback invoked]:', err.message);
      }
    }

    // High quality clinical fallback in detected language with simple words
    let reply = '';
    const lower = queryText.toLowerCase();

    if (isGujarati) {
      if (!queryText || lower.includes('hello') || lower.includes('hi') || lower.includes('kem') || lower.includes('namaste')) {
        reply = `નમસ્તે ${userName}! હું ${doctorName} છું. હું સ્ક્રીન પર ${petName} ને જોઈ શકું છું. મને સરળ શબ્દોમાં કહો, ${petName} ને શું તકલીફ થઈ રહી છે?`;
      } else if (lower.includes('khana') || lower.includes('jamto') || lower.includes('ulti') || lower.includes('pet') || lower.includes('stomach')) {
        reply = `હું તમારી ચિંતા સમજી શકું છું. ${petName} ને થોડું હલકું બાફેલું ભાત અને સાદું પાણી આપો. ભારે ખોરાક કે મસાલેદાર વસ્તુઓ ન આપો. જો ઉલ્ટી વધે તો તાત્કાલિક ક્લિનિક લઈ જવું.`;
      } else if (lower.includes('itch') || lower.includes('khaj') || lower.includes('chamdi') || lower.includes('scratch')) {
        reply = `હા, ખંજવાળ કે એલર્જી સામાન્ય છે. ${petName} ને તે જગ્યા વારંવાર ચાટવા ન દો. કેમેરા થોડો નજીક લાવીને તે ભાગ મને બતાવી શકો છો?`;
      } else {
        reply = `હું તમારી વાત બરાબર સમજી ગયો/ગઈ છું. ${petName} ને શાંત અને આરામદાયક વાતાવરણમાં રાખો. હું અહીં જ છું, મને વધુ વિગત આપો.`;
      }
    } else if (isHindi) {
      if (!queryText || lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('doctor')) {
        reply = `नमस्ते ${userName}! मैं ${doctorName} हूँ। मैं ${petName} को वीडियो पर देख पा रहा/रही हूँ। आप बिल्कुल चिंता न करें, बताइए ${petName} को क्या समस्या हो रही है?`;
      } else if (lower.includes('khana') || lower.includes('bhookh') || lower.includes('ulti') || lower.includes('pet') || lower.includes('vomit') || lower.includes('dast')) {
        reply = `मैं आपकी बात समझ गया/गई। ${petName} का पेट थोड़ा खराब लग रहा है। अभी के लिए उसे सादा उबला चावल और हल्का पानी दें। अगर उल्टी दोबारा हो तो तुरंत मुझे बताएं।`;
      } else if (lower.includes('khujli') || lower.includes('scratch') || lower.includes('skin') || lower.includes('chamdi')) {
        reply = `हाँ, मौसम बदलने से पेट्स को स्किन में खुजली हो सकती है। आप कैमरा थोड़ा पास लाकर ${petName} की स्किन या कान दिखाइए ताकि मैं चेक कर सकूँ।`;
      } else {
        reply = `धन्यवाद ${userName} जी। मैंने आपकी बात नोट कर ली है। ${petName} को आराम करने दें और साफ़ ताज़ा पानी पीने दें। हम मिलकर इसका आसान हल निकालेंगे।`;
      }
    } else {
      // Simple English
      if (!queryText || lower.includes('hello') || lower.includes('hi') || lower.includes('join')) {
        reply = `Hello ${userName}! I'm ${doctorName}. I have ${petName}'s profile right in front of me on video. How is ${petName} feeling, and what problem can I help you with today?`;
      } else if (lower.includes('itch') || lower.includes('scratch') || lower.includes('ear') || lower.includes('skin')) {
        reply = `I see the itchy spot you are pointing to. Please don't let ${petName} scratch it too hard. Could you hold the camera a little closer to the skin so I can take a closer look?`;
      } else if (lower.includes('eat') || lower.includes('vomit') || lower.includes('poop') || lower.includes('stomach') || lower.includes('food')) {
        reply = `I understand your concern. For an upset tummy, give ${petName} a light meal of plain boiled rice and boiled chicken. Make sure fresh drinking water is always nearby.`;
      } else {
        reply = `Thank you for sharing that with me, ${userName}. Based on what you described, let's keep ${petName} calm and comfortable. I'm right here with you on video.`;
      }
    }

    return res.json({
      success: true,
      data: {
        reply,
        spokenText: reply.replace(/[*_#]/g, ''),
        doctorName,
        doctorGender: resolvedGender,
        detectedLanguage: detectedLangCode,
        petName,
        userName
      }
    });
  }
});
