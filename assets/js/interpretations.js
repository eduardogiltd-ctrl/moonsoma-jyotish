/*
 * Moon & Soma Jyotish — reading texts.
 *
 * DRAFT copy for Aya to rewrite in her own voice. Each entry is plain text;
 * keep them short — they are prompts for the consultation, not full readings.
 */
(function (root) {
  'use strict';

  root.MSJyotishTexts = {
    lagna: {
      Aries: 'A body and spirit that lead with fire. Initiative comes naturally; the work is learning to pause before acting. Mars, the lagna lord, shows where the courage is spent.',
      Taurus: 'A steady, sensual constitution rooted in the earth. Comfort, beauty and loyalty matter deeply. Venus as lagna lord shows what truly nourishes.',
      Gemini: 'A quick, curious mind that lives through words and connection. Variety feeds the spirit; grounding practices calm the nerves. Look to Mercury for the thread.',
      Cancer: 'A tender, receptive nature ruled by the Moon. Home, memory and emotional safety shape everything. Rhythms that honour the lunar cycle bring balance.',
      Leo: 'A warm, radiant presence that wants to create and be seen. Dignity and generosity are the gifts; the Sun\'s placement shows where the heart shines.',
      Virgo: 'A discerning, service-oriented nature with a fine eye for detail. Health, ritual and refinement are natural paths. Mercury reveals how the mind finds peace.',
      Libra: 'A graceful, relational nature seeking harmony and fairness. Partnerships are the mirror. Venus as lagna lord shows where balance is found.',
      Scorpio: 'A deep, intense nature drawn to what is hidden. Transformation is the life theme. Mars shows where that power is focused — and where to let go.',
      Sagittarius: 'An open, philosophical spirit oriented to meaning and truth. Teachers, travel and dharma guide the path. Jupiter shows where wisdom ripens.',
      Capricorn: 'A patient, structured nature that builds over time. Responsibility comes early, rewards come later. Saturn as lagna lord shows the discipline that liberates.',
      Aquarius: 'An independent, humanitarian mind with a vision for the collective. Saturn rules here too: structure in service of ideals and community.',
      Pisces: 'A fluid, intuitive and compassionate nature with a porous boundary to the unseen. Devotion and imagination are gifts; Jupiter shows how to stay anchored.'
    },

    moonSign: {
      Aries: 'Emotions arrive fast and burn clean. Needs movement and honest expression to feel at ease.',
      Taurus: 'The Moon is exalted here: a calm, contented heart that is soothed by nature, food and touch.',
      Gemini: 'A restless, talkative mind. Feelings are processed through conversation and writing.',
      Cancer: 'The Moon in its own sign: deeply feeling, nurturing, attached to home and family.',
      Leo: 'A proud, generous heart that needs warmth, recognition and creative play.',
      Virgo: 'A careful, analytical mind that soothes itself through order, service and daily ritual.',
      Libra: 'Emotional balance comes through relationship, beauty and harmony in the surroundings.',
      Scorpio: 'The Moon is debilitated here: feelings run deep and private. Healing comes through trust and depth rather than avoidance.',
      Sagittarius: 'An optimistic, seeking heart. Freedom, study and faith keep the mind buoyant.',
      Capricorn: 'Feelings are held with restraint and responsibility. Security is built slowly and steadily.',
      Aquarius: 'A detached, idealistic mind that finds comfort in friendship, ideas and community.',
      Pisces: 'A dreamy, compassionate and absorbent heart. Needs solitude, music and spiritual practice to clear the field.'
    },

    nakshatra: {
      'Aśvinī': 'The horse-headed healers. Swift beginnings, instinctive healing gifts, a youthful and pioneering spirit.',
      'Bharaṇī': 'The bearer. Themes of birth, death and restraint; great capacity to carry responsibility and creative intensity.',
      'Kṛttikā': 'The razor-sharp flame of Agni. Purifying, discerning and protective — cuts through to the truth.',
      'Rohiṇī': 'The ruddy one, the Moon\'s favourite. Fertile, beautiful, magnetic; a love of growth and abundance.',
      'Mṛgaśirā': 'The deer\'s head. Gentle searching curiosity; always seeking the next scent of meaning.',
      'Ārdrā': 'The teardrop of Rudra. Storms that clear the air; transformation through emotional honesty.',
      'Punarvasu': 'Return of the light. Renewal, homecoming and an inner optimism that restores what was lost.',
      'Puṣya': 'The nourisher. Most auspicious of nakshatras; devotion, care and spiritual sustenance.',
      'Āśleṣā': 'The coiled serpent. Hypnotic, perceptive, mystical; learning to use kundalini power wisely.',
      'Maghā': 'The throne of the ancestors. Lineage, dignity and honouring those who came before.',
      'Pūrva Phalgunī': 'The front legs of the bed. Pleasure, rest, romance and the joy of creative expression.',
      'Uttara Phalgunī': 'The back legs of the bed. Patronage, partnership and keeping one\'s word.',
      'Hasta': 'The hand. Skill, craftsmanship, healing touch and a gift for making things happen.',
      'Citrā': 'The bright jewel. Artistry, design and the drive to create something beautiful and lasting.',
      'Svātī': 'The sword in the wind. Independence, flexibility and a self-made path.',
      'Viśākhā': 'The forked branch. Single-minded purpose and the patience to reach the goal.',
      'Anurādhā': 'Following Radha. Devotion, friendship and success through cooperation.',
      'Jyeṣṭhā': 'The eldest. Seniority, protection and the responsibility that comes with power.',
      'Mūla': 'The root. Going to the bottom of things; uprooting in order to find the truth.',
      'Pūrva Āṣāḍhā': 'The invincible waters. Purifying conviction, persuasive and unstoppable.',
      'Uttara Āṣāḍhā': 'The later victory. Enduring, principled success built on integrity.',
      'Śravaṇa': 'The ear. Listening, learning and the wisdom transmitted through sound.',
      'Dhaniṣṭhā': 'The drum. Rhythm, music, wealth and abundance shared with the community.',
      'Śatabhiṣā': 'The hundred healers. Secrecy, medicine and solitary insight into hidden causes.',
      'Pūrva Bhādrapadā': 'The front of the funeral cot. Fiery idealism, intense austerity and transformation.',
      'Uttara Bhādrapadā': 'The serpent of the deep. Wisdom, patience and stillness of the depths.',
      'Revatī': 'The wealthy one, the shepherd. Gentle guidance, safe passage and completion of the journey.'
    },

    dasha: {
      Sun: 'A period to step into authority and clarity of purpose. Father, government and vitality are highlighted.',
      Moon: 'A period of feeling, nurturing and public life. Mother, home and emotional wellbeing come to the fore.',
      Mars: 'A period of energy, courage and action. Property, siblings and competition can be active; channel the heat.',
      Rahu: 'A period of ambition and unusual experiences. Desire and the unfamiliar pull strongly; grounding is essential.',
      Jupiter: 'A period of growth, teaching and grace. Children, mentors and wisdom traditions often feature.',
      Saturn: 'A period of discipline, work and maturation. Slow, karmic and ultimately rewarding for patient effort.',
      Mercury: 'A period of learning, commerce and communication. Writing, study and adaptable thinking are favoured.',
      Ketu: 'A period of detachment and inner seeking. What is outgrown falls away; spiritual practice deepens.',
      Venus: 'A period of love, beauty and comfort. Relationships, art and refinement of the senses are central.'
    }
  };
})(typeof self !== 'undefined' ? self : this);
