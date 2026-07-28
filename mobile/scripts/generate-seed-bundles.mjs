import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { strToU8, zipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_ROOT = path.join(ROOT, 'seed');
const REGISTRY_PATH = path.join(ROOT, 'src', 'seed', 'generatedRegistry.ts');
const SUBJECT_META = {
  science: {
    appSubject: 'SCIENCE',
    color: '#0B9B72',
    tint: '#D7F6EA',
    icon: 'SCIENCE LAB',
  },
  math: {
    appSubject: 'MATH',
    color: '#5146E5',
    tint: '#E8E7FF',
    icon: 'MATH MODEL',
  },
  english: {
    appSubject: 'ENGLISH',
    color: '#D35435',
    tint: '#FFE5DC',
    icon: 'LANGUAGE MAP',
  },
};

const CURRICULUM = {
  1: {
    science: [
      ['Using Our Senses', 'five senses', 'Our eyes, ears, nose, tongue, and skin help us learn about the world.', 'A ripe mango can look yellow, smell sweet, feel smooth, and taste juicy.', 'Choose a safe classroom object and describe it with three senses.'],
      ['Parts of the Body', 'body parts', 'Body parts have different jobs that help us move, work, and stay safe.', 'Legs help us walk while hands help us hold a pencil.', 'Point to five body parts and tell one job for each.'],
      ['Living and Nonliving Things', 'living things', 'Living things grow and need air, water, and food; nonliving things do not grow.', 'A seedling grows taller, but a stone stays the same size.', 'Sort six nearby objects into living and nonliving groups.'],
      ['What Living Things Need', 'basic needs', 'Plants and animals need suitable food, water, air, and shelter to live.', 'A potted plant wilts when it does not receive enough water.', 'Draw a home that gives a pet food, water, air, and shelter.'],
      ['Materials Around Us', 'materials', 'Objects are made from materials such as wood, metal, plastic, cloth, and glass.', 'A spoon may be metal because metal is hard and easy to clean.', 'Find one object made from each of four different materials.'],
      ['Weather Today', 'weather', 'Weather tells whether the day is sunny, cloudy, rainy, or windy.', 'Dark clouds and falling drops show that the weather is rainy.', 'Observe the sky and make a weather symbol for today.'],
    ],
    math: [
      ['Numbers to 100', 'place value', 'Two-digit numbers have tens and ones.', 'In 47, four tens make 40 and seven ones make 7.', 'Build three two-digit numbers using bundles of ten and single objects.'],
      ['Comparing Numbers', 'greater and less', 'Compare tens first, then ones, to decide which number is greater.', '63 is greater than 58 because six tens are more than five tens.', 'Arrange 24, 42, and 29 from least to greatest.'],
      ['Joining to Add', 'addition', 'Addition finds how many there are when groups are joined.', 'Three shells plus two shells make five shells.', 'Make two small groups of counters and write their addition sentence.'],
      ['Taking Away', 'subtraction', 'Subtraction finds how many remain after some are taken away.', 'Seven crayons take away three crayons leaves four crayons.', 'Act out a subtraction story with ten bottle caps.'],
      ['Flat and Solid Shapes', 'shapes', 'Flat shapes have length and width; solid shapes also have depth.', 'A coin looks like a circle while a ball is shaped like a sphere.', 'Sort classroom objects by the shape they resemble.'],
      ['Measuring and Time', 'measurement', 'We compare length, weight, capacity, and time using suitable units.', 'A pencil can be longer than an eraser, and lunch happens after morning class.', 'Order three objects from shortest to longest.'],
    ],
    english: [
      ['Letters and Their Sounds', 'letter sounds', 'Letters represent sounds that combine to make spoken and written words.', 'The letter m begins the words map, mat, and moon.', 'Say the first sound in five familiar object names.'],
      ['Rhyming Words', 'rhymes', 'Rhyming words have the same ending sound.', 'Cat, hat, and mat share the ending sound at.', 'Name two words that rhyme with sun.'],
      ['Naming Words', 'nouns', 'A naming word tells the name of a person, place, animal, or thing.', 'Teacher, park, dog, and book are naming words.', 'Find and list five naming words in the classroom.'],
      ['Action Words', 'verbs', 'An action word tells what someone or something does.', 'Run, read, sing, and jump are action words.', 'Act out three action words for a partner to guess.'],
      ['Building a Sentence', 'sentence', 'A sentence shares a complete idea, starts with a capital letter, and ends with punctuation.', 'The bird sings. is a complete sentence.', 'Arrange word cards to make two complete sentences.'],
      ['Beginning, Middle, and End', 'story sequence', 'Events in a story happen in an order: beginning, middle, and end.', 'First Ana plants a seed, next she waters it, and finally a sprout appears.', 'Retell a short story using first, next, and last.'],
    ],
  },
  2: {
    science: [
      ['Keeping the Body Healthy', 'healthy habits', 'Cleanliness, nutritious food, movement, and rest help body parts work well.', 'Washing hands with soap removes dirt before eating.', 'Make a four-part healthy-day plan.'],
      ['Plants and Their Parts', 'plant parts', 'Roots, stems, leaves, flowers, fruits, and seeds have connected jobs.', 'Roots take in water while the stem carries it upward.', 'Label a local plant and explain two part functions.'],
      ['Animals and Their Homes', 'habitats', 'A habitat provides the food, water, shelter, and space an animal needs.', 'A fish has body parts suited to a watery habitat.', 'Match four animals to suitable habitats and explain why.'],
      ['Solids, Liquids, and Gases', 'states of matter', 'Matter can be solid, liquid, or gas based on its shape and how it fills space.', 'Water takes the shape of its cup, while ice keeps its own shape.', 'Classify safe household examples by state.'],
      ['Pushes and Pulls', 'force', 'A push or pull can start, stop, speed up, slow down, or turn an object.', 'A gentle push makes a toy car roll forward.', 'Test how different pushes change a toy car motion.'],
      ['Weather and Seasons', 'weather patterns', 'Daily observations reveal patterns in clouds, rain, wind, and temperature.', 'Several rainy days may require umbrellas and indoor plans.', 'Keep a seven-day picture weather record.'],
    ],
    math: [
      ['Place Value to 1,000', 'hundreds tens ones', 'Three-digit numbers are composed of hundreds, tens, and ones.', '352 is three hundreds, five tens, and two ones.', 'Represent 406 with place-value drawings.'],
      ['Adding Three-Digit Numbers', 'addition strategies', 'Add ones, tens, and hundreds while regrouping when a place reaches ten.', 'In 268 + 157, eight ones plus seven ones regroup as one ten and five ones.', 'Solve an addition story using a place-value chart.'],
      ['Subtracting Three-Digit Numbers', 'subtraction strategies', 'Regroup one larger place when a smaller place does not have enough units.', 'To subtract eight ones from two ones, regroup one ten as ten ones.', 'Explain each regrouping step in 432 - 178.'],
      ['Equal Groups', 'multiplication', 'Multiplication describes equal groups and repeated addition.', 'Four bags with three marbles each contain twelve marbles.', 'Build and draw three equal-group stories.'],
      ['Halves, Thirds, and Fourths', 'unit fractions', 'Equal parts of one whole can be named with fractions.', 'One of four equal sandwich pieces is one fourth.', 'Fold paper into equal halves and fourths.'],
      ['Length, Time, and Money', 'practical measurement', 'Standard units and Philippine coins help describe and solve daily situations.', 'A ruler measures centimeters, while a clock measures elapsed time.', 'Plan a small purchase and count the exact coins needed.'],
    ],
    english: [
      ['Blends and Digraphs', 'word patterns', 'Letter groups such as bl, st, sh, and ch help readers decode words.', 'Ship begins with sh, a two-letter sound.', 'Sort word cards by their beginning blend or digraph.'],
      ['Common and Proper Nouns', 'noun types', 'Common nouns name general people or places; proper nouns name specific ones and use capitals.', 'city is common, while Manila is proper.', 'Rewrite five common nouns with matching proper examples.'],
      ['Present and Past Actions', 'verb tense', 'Verb forms show whether an action happens now or happened before.', 'I walk today; I walked yesterday.', 'Change five present-tense actions into past tense.'],
      ['Describing Words', 'adjectives', 'Adjectives tell size, color, number, shape, or quality.', 'Three bright kites adds number and color details.', 'Add two useful adjectives to each of three nouns.'],
      ['Kinds of Sentences', 'sentence purpose', 'Statements, questions, commands, and exclamations have different purposes and punctuation.', 'Where is my bag? asks a question.', 'Write one example of each sentence kind.'],
      ['Characters and Setting', 'story elements', 'Characters act in a story, and the setting tells where and when events happen.', 'Lina is the character, and the school garden is the setting.', 'Identify the characters and setting in a familiar tale.'],
    ],
  },
  3: {
    science: [
      ['The Human Body Works Together', 'body systems', 'Groups of organs work together to move materials, sense changes, and support life.', 'The lungs bring oxygen in while blood carries it around the body.', 'Trace the path of air from the nose to the lungs.'],
      ['Plant Life Cycles', 'life cycle', 'Flowering plants pass through seed, germination, growth, flowering, and seed production.', 'A bean seed sprouts roots before its first leaves open.', 'Observe and record a seed for one week.'],
      ['Animal Groups and Adaptations', 'adaptation', 'Body coverings, movement, and feeding structures help animals survive.', 'A duck has webbed feet that help it paddle.', 'Compare how two animals move and get food.'],
      ['Changes in Matter', 'physical change', 'Heating, cooling, cutting, bending, and mixing can change matter without making a new substance.', 'Ice melting changes state but remains water.', 'Observe one reversible and one hard-to-reverse change.'],
      ['Motion and Simple Machines', 'motion', 'Position changes over time, and simple machines can make work easier.', 'A ramp lets a box move upward with less lifting force.', 'Compare moving an object with and without a ramp.'],
      ['Earth, Moon, and Sky Patterns', 'sky patterns', 'The Sun, Moon, and stars appear in predictable daily and monthly patterns.', 'Shadows change direction as the Sun appears to move across the sky.', 'Measure one shadow at three times of day.'],
    ],
    math: [
      ['Place Value to 10,000', 'four-digit numbers', 'Thousands, hundreds, tens, and ones determine a digit value.', 'In 6,241, the 6 represents six thousand.', 'Write three numbers in standard and expanded form.'],
      ['Addition and Subtraction Problems', 'multi-step operations', 'Estimate, compute accurately, and check whether an answer fits the situation.', 'A library with 2,350 books adds 475 and removes 128.', 'Write and solve a two-step classroom inventory problem.'],
      ['Multiplication and Division Facts', 'fact families', 'Multiplication and division are inverse operations built from equal groups.', '6 x 4 = 24, so 24 / 6 = 4.', 'Create four related facts from one array.'],
      ['Fractions on a Number Line', 'fraction magnitude', 'Fractions name equal intervals between whole numbers.', 'Three fourths is the third one-fourth step from zero.', 'Place halves, fourths, and eighths on a number line.'],
      ['Lines, Angles, and Polygons', 'geometry', 'Geometric figures can be classified by sides, vertices, lines, and angles.', 'A rectangle has four right angles and two pairs of parallel sides.', 'Sort polygons and explain the rule used.'],
      ['Measurement and Data Displays', 'data', 'Measurements can be organized in tables, pictographs, and bar graphs.', 'A bar graph can compare the number of books read each day.', 'Collect class data and build a labeled bar graph.'],
    ],
    english: [
      ['Using Context Clues', 'context clues', 'Nearby words and examples help readers infer an unfamiliar word meaning.', 'The arid land was dry and dusty, so arid means dry.', 'Underline clues that reveal three unknown words.'],
      ['Nouns and Pronouns', 'pronoun reference', 'Pronouns replace nouns while keeping the reader clear about who or what is meant.', 'Maria planted seeds. She watered them.', 'Replace repeated nouns with clear pronouns.'],
      ['Regular and Irregular Verbs', 'verb forms', 'Some past verbs add ed while others change form.', 'Jump becomes jumped, but go becomes went.', 'Sort ten verbs as regular or irregular.'],
      ['Adjectives and Adverbs', 'modifiers', 'Adjectives describe nouns; adverbs often describe how actions happen.', 'The careful child walked slowly.', 'Expand three sentences with precise modifiers.'],
      ['Writing a Clear Paragraph', 'main idea', 'A paragraph has a focused main idea and supporting details in a logical order.', 'A topic sentence about recycling is followed by reasons and examples.', 'Plan a paragraph with one main idea and three details.'],
      ['Narrative Sequence and Dialogue', 'narrative', 'Narratives organize events and use dialogue to reveal character and action.', 'Quotation marks show the exact words a character speaks.', 'Write a short beginning, problem, and ending with dialogue.'],
    ],
  },
  4: {
    science: [
      ['Major Organ Systems', 'organ systems', 'Digestive, respiratory, circulatory, skeletal, and muscular systems interact to support the body.', 'Muscles pull on bones while blood supplies working cells with oxygen.', 'Make a flow diagram connecting three body systems during exercise.'],
      ['Food Chains and Ecosystems', 'food chain', 'Energy moves from the Sun to producers and then to consumers and decomposers.', 'Grass feeds a grasshopper, which may feed a frog.', 'Build a local food chain and predict one population change.'],
      ['States and Properties of Matter', 'matter properties', 'Mass, volume, shape, solubility, and state help describe and identify matter.', 'Salt dissolves in water, but sand settles.', 'Compare three materials using a property table.'],
      ['Force, Motion, and Energy', 'energy transfer', 'Forces change motion, while energy can be transferred through movement, heat, light, and sound.', 'A stretched rubber band stores energy that becomes motion.', 'Change one variable in a rolling-car investigation.'],
      ['Weather and Climate', 'climate', 'Weather is short-term atmospheric condition; climate describes patterns over many years.', 'One rainy afternoon is weather, while a region long wet season is climate.', 'Compare daily weather records with a climate description.'],
      ['Earth Materials and Surface Change', 'erosion', 'Weathering breaks rock, erosion moves sediment, and deposition drops it elsewhere.', 'Flowing water carries soil downhill after heavy rain.', 'Model erosion with soil, water, and a tray.'],
    ],
    math: [
      ['Whole Numbers to Millions', 'large numbers', 'Digit position determines value through millions, and rounding gives useful estimates.', '3,482,190 rounds to 3,500,000 to the nearest hundred thousand.', 'Read, compare, and round population figures.'],
      ['Multiplication Strategies', 'multi-digit multiplication', 'Partial products and place value explain multi-digit multiplication.', '23 x 14 combines 23 x 10 and 23 x 4.', 'Solve one product with an area model and standard algorithm.'],
      ['Division with Remainders', 'division', 'Division can share equally or measure groups, sometimes leaving a remainder.', '53 books placed on shelves of 8 leave 5 books after 6 full shelves.', 'Interpret a remainder in two real situations.'],
      ['Equivalent Fractions', 'fraction equivalence', 'Multiplying or dividing numerator and denominator by the same number names the same amount.', 'One half equals two fourths and four eighths.', 'Use fraction strips to find three equivalents.'],
      ['Decimals and Money', 'decimal place value', 'Tenths and hundredths connect fractions, decimals, and money.', '0.75 is seventy-five hundredths or seventy-five centavos of one peso.', 'Compare prices and compute a simple total.'],
      ['Angles, Symmetry, and Data', 'geometric reasoning', 'Angles measure turns, symmetry matches balanced parts, and graphs summarize observations.', 'A right angle is a quarter turn measuring 90 degrees.', 'Find lines of symmetry and measure sample angles.'],
    ],
    english: [
      ['Prefixes, Suffixes, and Roots', 'word parts', 'Meaningful word parts help readers unlock unfamiliar vocabulary.', 'replay combines re, meaning again, with play.', 'Build and define six words from known roots and affixes.'],
      ['Noun and Pronoun Agreement', 'agreement', 'Pronouns must clearly match the nouns they replace in number and meaning.', 'The pupils packed their bags uses a plural pronoun.', 'Repair unclear pronouns in five sentences.'],
      ['Verb Tense Consistency', 'consistent tense', 'Writers keep time relationships clear by choosing consistent verb tenses.', 'Yesterday we walked and talked, not walked and talk.', 'Edit a paragraph with shifting verb tense.'],
      ['Precise Adjectives and Adverbs', 'word choice', 'Precise modifiers create clearer descriptions without unnecessary repetition.', 'The narrow path curved sharply gives exact details.', 'Replace weak modifiers with specific choices.'],
      ['Paragraph Organization', 'text organization', 'Transitions connect a topic sentence, supporting evidence, and conclusion.', 'First, for example, and therefore show relationships between ideas.', 'Reorder mixed sentences into a coherent paragraph.'],
      ['Reading Informational Text', 'text features', 'Headings, captions, diagrams, and glossaries help readers locate and interpret information.', 'A caption explains what a photograph demonstrates.', 'Use text features to answer questions from an article.'],
    ],
  },
  5: {
    science: [
      ['Cells as Basic Units of Life', 'cells', 'Cells carry out basic life functions and contain structures with specialized roles.', 'A plant cell wall supports the cell while chloroplasts capture light energy.', 'Compare labeled plant and animal cell diagrams.'],
      ['Reproduction and Growth', 'reproduction', 'Living things reproduce in varied ways and pass through predictable growth stages.', 'Flowering plants form seeds after pollination.', 'Sequence one plant and one animal life cycle.'],
      ['Ecosystem Relationships', 'ecosystem interactions', 'Organisms compete, cooperate, and depend on abiotic factors within ecosystems.', 'Mangrove roots shelter young fish while holding coastal sediment.', 'Map four interactions in a Philippine ecosystem.'],
      ['Mixtures and Solutions', 'mixtures', 'Mixture parts keep their properties and can be separated using physical methods.', 'Filtering separates insoluble sand from water.', 'Choose methods to separate three sample mixtures.'],
      ['Motion, Light, and Electricity', 'energy systems', 'Forces affect motion, light travels and reflects, and closed circuits carry electric current.', 'A bulb lights when wires form a complete circuit.', 'Build and troubleshoot a simple low-voltage circuit model.'],
      ['Weather Systems and Natural Hazards', 'weather systems', 'Air pressure, wind, moisture, and landforms influence weather and hazard risk.', 'Warm ocean water can supply energy to a tropical cyclone.', 'Read a simple weather map and plan one safety action.'],
    ],
    math: [
      ['Whole-Number Operations', 'operation fluency', 'Place-value reasoning, estimation, and inverse operations support accurate computation.', 'Estimate 48,920 + 31,175 as about 80,000 before calculating.', 'Solve and check a multi-step budget problem.'],
      ['Adding and Subtracting Fractions', 'fraction operations', 'Fractions need common units before numerators can be combined.', 'One half plus one fourth becomes two fourths plus one fourth.', 'Model three fraction sums using area bars.'],
      ['Decimal Operations', 'decimal operations', 'Align place values when adding or subtracting decimals and reason about magnitude.', '12.50 - 3.75 equals 8.75.', 'Compute change from a realistic shopping list.'],
      ['Ratios and Percent Foundations', 'ratio', 'Ratios compare quantities, while percent names a ratio out of one hundred.', 'Three red beads to five blue beads is the ratio 3:5.', 'Represent one classroom ratio in three forms.'],
      ['Area, Volume, and Geometry', 'measurement formulas', 'Area measures surface coverage and volume measures three-dimensional space.', 'A rectangular prism volume is length times width times height.', 'Measure a box and calculate its volume.'],
      ['Data and Probability', 'data reasoning', 'Tables and graphs reveal center, spread, frequency, and possible outcomes.', 'A fair coin has two equally likely outcomes.', 'Conduct twenty trials and compare experimental results.'],
    ],
    english: [
      ['Denotation and Connotation', 'word meaning', 'Words can share a dictionary meaning but carry different feelings or associations.', 'slim and skinny both describe thinness but suggest different tones.', 'Rank related words from positive to negative tone.'],
      ['Pronouns and Antecedents', 'pronoun clarity', 'A pronoun needs a clear antecedent and correct number and person.', 'Each learner brought his or her notebook avoids an unclear reference.', 'Edit ambiguous pronouns in a short passage.'],
      ['Perfect and Progressive Verbs', 'verb aspect', 'Verb aspect shows whether an action is completed or continuing.', 'She has finished is perfect; she is finishing is progressive.', 'Describe one activity using three verb aspects.'],
      ['Simple, Compound, and Complex Sentences', 'sentence structure', 'Clauses combine to show equal or dependent relationships between ideas.', 'We stayed inside because the rain was heavy is complex.', 'Combine short ideas using coordination and subordination.'],
      ['Informational Text Structures', 'text structure', 'Authors organize information through sequence, cause-effect, comparison, description, or problem-solution.', 'A typhoon safety article may use problem-solution structure.', 'Identify structure clues in three paragraphs.'],
      ['Fact, Opinion, and Evidence', 'evidence', 'Facts can be checked, opinions express judgments, and strong claims use relevant evidence.', 'The river is 20 kilometers long is verifiable.', 'Classify statements and support one opinion with facts.'],
    ],
  },
  6: {
    science: [
      ['Organ Systems and Homeostasis', 'homeostasis', 'Body systems coordinate to maintain stable internal conditions during changing activity.', 'Sweating helps lower body temperature during exercise.', 'Explain how three systems respond during a run.'],
      ['Cycles in Ecosystems', 'matter cycles', 'Water, carbon, and nutrients cycle through organisms and the environment while energy flows.', 'Decomposers return nutrients from dead matter to soil.', 'Trace water through a local ecosystem model.'],
      ['Properties and Separation of Matter', 'separation methods', 'Observable properties guide filtration, evaporation, decantation, and magnetism.', 'Evaporation can recover salt dissolved in water.', 'Design a sequence to separate a mixed sample.'],
      ['Energy Transformation and Circuits', 'energy transformation', 'Energy changes form while total energy is conserved within a system.', 'A battery chemical energy becomes electrical energy and then light.', 'Label energy changes in three household devices.'],
      ['Earth Systems and Hazards', 'earth systems', 'The geosphere, hydrosphere, atmosphere, and biosphere interact and create hazards.', 'Heavy rain on a bare slope can trigger a landslide.', 'Connect a hazard to interacting Earth systems.'],
      ['The Solar System', 'solar system', 'Gravity organizes planets and moons, and predictable motions produce observable cycles.', 'Earth rotation causes day and night while revolution defines a year.', 'Use a scale model to compare orbital order.'],
    ],
    math: [
      ['Fraction and Decimal Fluency', 'rational operations', 'Fractions and decimals represent rational quantities and can be converted for efficient computation.', 'Three fourths equals 0.75.', 'Choose fraction or decimal form to solve three contexts.'],
      ['Ratios, Rates, and Percent', 'proportional reasoning', 'Equivalent ratios connect rates, proportions, and percentages.', 'If 2 notebooks cost 50 pesos, the unit rate is 25 pesos each.', 'Use a ratio table to solve a discount problem.'],
      ['Integers and the Number Line', 'integers', 'Positive and negative numbers describe quantities relative to zero.', 'An elevation of -5 meters is below sea level.', 'Model temperature changes with integer operations.'],
      ['Expressions and Equations', 'algebraic thinking', 'Variables represent unknown or changing quantities, and equations express equality.', '3x + 2 = 14 can be solved by undoing operations.', 'Translate three word situations into expressions.'],
      ['Geometry and Surface Area', 'spatial measurement', 'Nets, formulas, and angle relationships support two- and three-dimensional reasoning.', 'A cube net contains six congruent squares.', 'Draw a prism net and calculate its surface area.'],
      ['Statistics and Data Interpretation', 'statistical reasoning', 'Mean, median, mode, range, and graphs summarize distributions differently.', 'An outlier can pull the mean away from the median.', 'Compare two data sets and choose a useful center.'],
    ],
    english: [
      ['Figurative Language', 'figurative meaning', 'Simile, metaphor, personification, and imagery create meaning beyond literal words.', 'The moon was a silver coin is a metaphor.', 'Explain the effect of figurative language in a poem.'],
      ['Pronoun Case and Agreement', 'pronoun case', 'Subject, object, and possessive pronouns take different roles in sentences.', 'She gave the map to him uses subject and object forms.', 'Choose correct pronoun forms in context.'],
      ['Active and Passive Voice', 'voice', 'Active voice emphasizes the doer; passive voice emphasizes the receiver or result.', 'Scientists measured rainfall is active.', 'Rewrite sentences and discuss the change in focus.'],
      ['Sentence Variety and Cohesion', 'cohesion', 'Varied structures and transitions connect ideas while maintaining clarity.', 'Although the road flooded, the rescue team arrived.', 'Revise a paragraph with varied openings and transitions.'],
      ['Citing Text Evidence', 'text evidence', 'Readers support inferences with accurate details and explanations from a text.', 'A quotation is useful only when the writer explains its relevance.', 'Write a claim-evidence-reasoning response.'],
      ['Argument and Research Basics', 'argument', 'Credible sources, clear claims, relevant evidence, and reasoning strengthen an argument.', 'A health claim should rely on qualified and current sources.', 'Compare two sources and defend which is more credible.'],
    ],
  },
  7: {
    science: [
      ['Scientific Inquiry and Measurement', 'scientific inquiry', 'Testable questions, controlled variables, repeated trials, and precise measurement strengthen evidence.', 'Changing only light exposure helps test its effect on seedling growth.', 'Design a fair test with independent and dependent variables.'],
      ['Cells and Microscopy', 'cell organization', 'Microscopes reveal cells whose structures support specialized functions and levels of organization.', 'Muscle cells contain structures suited for contraction.', 'Calculate magnification and compare cell types.'],
      ['Interactions in Ecosystems', 'ecological balance', 'Energy pyramids, food webs, limiting factors, and biodiversity shape ecosystem stability.', 'Removing a predator can increase prey and reduce plant abundance.', 'Predict two effects of a food-web disturbance.'],
      ['Particles and Changes of Matter', 'particle model', 'Particle arrangement and motion explain states, diffusion, and physical or chemical change.', 'Heating increases particle motion and can cause melting.', 'Use particle drawings to compare three states.'],
      ['Motion and Forces', 'net force', 'Speed, velocity, acceleration, and net force describe and explain changing motion.', 'Balanced forces produce no change in motion.', 'Graph position over time for a moving object.'],
      ['Earth Structure and Geologic Processes', 'geologic processes', 'Earth layers, plate movement, weathering, and erosion continually reshape the surface.', 'Converging plates can build mountains or form trenches.', 'Interpret a plate-boundary diagram and hazard pattern.'],
    ],
    math: [
      ['Sets and Real-World Classification', 'sets', 'Set notation represents collections, subsets, unions, intersections, and complements.', 'Students in music or sports can be shown with a Venn diagram.', 'Survey a class and model results with sets.'],
      ['Integers and Rational Numbers', 'rational numbers', 'Properties of operations extend to positive and negative fractions and decimals.', 'Subtracting a negative is equivalent to adding its opposite.', 'Explain temperature and debt changes on a number line.'],
      ['Algebraic Expressions', 'expressions', 'Terms, coefficients, exponents, and properties support simplifying and evaluating expressions.', '3x + 2x - 4 simplifies to 5x - 4.', 'Model a perimeter with an algebraic expression.'],
      ['Linear Equations and Inequalities', 'linear relationships', 'Inverse operations solve equations, while inequality solutions represent ranges.', '2x + 5 < 17 gives x < 6.', 'Solve and graph a practical inequality.'],
      ['Geometry of Polygons', 'polygon relationships', 'Angle sums, congruence, and properties classify polygons and solve unknown measures.', 'Triangle interior angles total 180 degrees.', 'Derive a quadrilateral angle sum by triangulation.'],
      ['Statistics and Sampling', 'sampling', 'Representative samples and suitable displays support responsible conclusions about populations.', 'A convenience sample may not represent the whole school.', 'Critique a survey method and improve it.'],
    ],
    english: [
      ['Listening and Oral Communication', 'communication strategies', 'Purpose, audience, tone, nonverbal cues, and active listening shape effective communication.', 'A formal report uses a different tone from a friendly conversation.', 'Adapt one message for two audiences.'],
      ['Vocabulary Through Word Relationships', 'semantic relationships', 'Synonyms, antonyms, analogies, and context reveal precise relationships among words.', 'Fragile is to breakable as sturdy is to strong.', 'Complete and explain five analogies.'],
      ['Grammar for Clear Meaning', 'grammar choices', 'Subject-verb agreement, modifiers, and consistent tense prevent ambiguity.', 'A misplaced modifier can attach a description to the wrong noun.', 'Edit a passage for three grammar problems.'],
      ['Elements of Short Stories', 'literary elements', 'Plot, conflict, character, setting, and point of view work together to build meaning.', 'A first-person narrator reveals one character perspective.', 'Map conflict and turning point in a short story.'],
      ['Evaluating Informational Text', 'source evaluation', 'Readers examine claims, evidence, organization, and source credibility.', 'A claim supported by data from a named study is stronger than an unsupported assertion.', 'Annotate claim, evidence, and source in an article.'],
      ['Process and Explanatory Writing', 'explanation', 'Effective explanations sequence ideas, define terms, and connect evidence to conclusions.', 'A process paragraph uses precise transitions and conditions.', 'Write and revise a clear how-to explanation.'],
    ],
  },
  8: {
    science: [
      ['Atomic Structure and the Periodic Table', 'atomic structure', 'Protons, neutrons, and electrons determine atomic identity, mass, charge, and periodic patterns.', 'Atomic number equals proton count.', 'Build particle models for three elements.'],
      ['Chemical Reactions', 'chemical reaction', 'Reactants rearrange atoms into products while mass is conserved in a closed system.', 'Gas formation, color change, or temperature change may indicate reaction.', 'Balance a simple particle-level reaction model.'],
      ['Forces and Newtonian Motion', 'Newton laws', 'Inertia, acceleration, mass, and action-reaction pairs explain forces and motion.', 'A loaded cart accelerates less than an empty cart under the same force.', 'Analyze forces in a transport safety scenario.'],
      ['Work, Power, and Energy', 'mechanical energy', 'Work transfers energy, power describes transfer rate, and machines trade force for distance.', 'Climbing the same stairs faster requires greater power.', 'Compare work and power for two trials.'],
      ['Earthquakes and Volcanoes', 'tectonic hazards', 'Plate interactions produce earthquakes, volcanoes, and patterns of geologic risk.', 'Subduction zones commonly form volcanic arcs.', 'Use hazard maps to justify a preparedness plan.'],
      ['Heredity and Variation', 'heredity', 'Genes carry inherited information while environment and recombination contribute to variation.', 'Siblings share genes but are not genetically identical.', 'Model trait probability with a simple cross.'],
    ],
    math: [
      ['Factoring Algebraic Expressions', 'factoring', 'Common factors and polynomial patterns reverse multiplication.', 'x squared + 5x + 6 factors as (x + 2)(x + 3).', 'Verify factors by expansion.'],
      ['Linear Equations in Two Variables', 'linear graph', 'A linear equation represents a constant rate and graphs as a straight line.', 'y = 2x + 1 has slope 2 and intercept 1.', 'Graph and interpret a real rate relationship.'],
      ['Systems of Linear Equations', 'systems', 'The intersection of two linear relationships satisfies both equations.', 'Two pricing plans are equal where their graphs cross.', 'Solve a system by graphing and substitution.'],
      ['Geometry and Transformations', 'transformations', 'Translations, rotations, reflections, and dilations preserve or scale geometric properties.', 'A reflection preserves lengths but reverses orientation.', 'Plot a figure and perform two transformations.'],
      ['Probability Models', 'probability model', 'Theoretical and experimental probabilities support predictions under uncertainty.', 'A sample space lists all possible outcomes.', 'Compare expected and observed results from repeated trials.'],
      ['Financial Mathematics', 'financial decisions', 'Percent increase, discount, tax, simple interest, and budgeting guide financial choices.', 'A 20 percent discount reduces a 500-peso item by 100 pesos.', 'Compare two purchase offers using total cost.'],
    ],
    english: [
      ['Rhetorical Appeals and Audience', 'rhetoric', 'Writers use credibility, emotion, logic, and audience awareness to persuade.', 'Reliable statistics support a logical appeal.', 'Identify and evaluate appeals in a short message.'],
      ['Vocabulary and Register', 'register', 'Word choice shifts across formal, informal, technical, and conversational settings.', 'request assistance is more formal than ask for help.', 'Rewrite one message in two registers.'],
      ['Parallelism and Sentence Control', 'parallel structure', 'Parallel grammatical forms make related ideas clear and balanced.', 'She likes reading, writing, and drawing uses parallel gerunds.', 'Repair faulty parallelism in a paragraph.'],
      ['Theme and Literary Interpretation', 'theme', 'Theme develops through character choices, conflict, symbols, and consequences.', 'A repeated image may reinforce a story central insight.', 'Support a theme statement with two details.'],
      ['Comparing Sources', 'source synthesis', 'Readers compare purpose, evidence, perspective, and omissions across sources.', 'Two reports may use the same event to support different conclusions.', 'Create a comparison matrix for two texts.'],
      ['Writing an Evidence-Based Response', 'analytical writing', 'A focused claim, selected evidence, explanation, and transitions build analysis.', 'Evidence becomes persuasive when reasoning connects it to the claim.', 'Draft and revise one analytical paragraph.'],
    ],
  },
  9: {
    science: [
      ['Cell Division and Organization', 'cell division', 'Mitosis supports growth and repair while cellular specialization builds tissues and organs.', 'Skin cells divide to replace damaged cells.', 'Sequence mitosis stages and connect them to growth.'],
      ['Genetics and Evolution', 'genetic variation', 'Mutation, recombination, selection, and inheritance change populations across generations.', 'A heritable trait that improves survival may become more common.', 'Analyze trait frequencies in a changing environment.'],
      ['Ecosystem Dynamics', 'population dynamics', 'Carrying capacity, feedback, disturbance, and succession affect populations over time.', 'A drought can reduce resources and lower carrying capacity.', 'Interpret a population graph after disturbance.'],
      ['Chemical Bonding and Reactions', 'chemical bonding', 'Electron interactions form bonds, and reaction equations represent conservation and energy change.', 'Ionic bonding transfers electrons between atoms.', 'Classify bonding models and balance equations.'],
      ['Motion in One Dimension', 'kinematics', 'Displacement, velocity, acceleration, and graphs provide complementary descriptions of motion.', 'The slope of a position-time graph represents velocity.', 'Analyze matching motion graphs and stories.'],
      ['Climate Systems and Human Activity', 'climate systems', 'Radiation balance, greenhouse gases, oceans, land use, and feedback shape climate.', 'Warmer oceans can alter weather patterns and sea level.', 'Evaluate evidence in a local climate-impact case.'],
    ],
    math: [
      ['Quadratic Expressions and Equations', 'quadratics', 'Quadratic relationships can be factored, completed as squares, graphed, or solved by formula.', 'The roots of x squared - 5x + 6 are 2 and 3.', 'Compare two methods for solving a quadratic.'],
      ['Radicals and Rational Exponents', 'radicals', 'Roots and rational exponents are inverse forms governed by exponent properties.', 'The square root of 49 is 7.', 'Simplify and estimate radical expressions.'],
      ['Variation and Proportion', 'variation', 'Direct, inverse, joint, and combined variation model changing quantities.', 'Travel time varies inversely with speed for fixed distance.', 'Build an equation from measured paired data.'],
      ['Similarity and Right Triangles', 'similarity', 'Proportional sides, angle relationships, and the Pythagorean theorem solve indirect measures.', 'Similar triangles can estimate a tree height from shadows.', 'Design an indirect measurement investigation.'],
      ['Coordinate Geometry', 'coordinate proof', 'Slope, distance, midpoint, and equations support geometric reasoning on a plane.', 'Equal slopes can establish parallel sides.', 'Use coordinates to classify a quadrilateral.'],
      ['Statistics and Correlation', 'correlation', 'Scatterplots, trend lines, and residuals describe association without proving causation.', 'A positive correlation means variables tend to rise together.', 'Interpret a scatterplot and state its limitations.'],
    ],
    english: [
      ['Communication Across Contexts', 'communicative competence', 'Purpose, audience, culture, register, and medium shape effective messages.', 'A public advisory prioritizes clarity and verified information.', 'Redesign one message for print and spoken delivery.'],
      ['Literary Devices and Meaning', 'literary analysis', 'Symbol, irony, imagery, motif, and structure contribute to layered interpretation.', 'Dramatic irony gives the audience knowledge a character lacks.', 'Trace one device across a literary selection.'],
      ['Grammar, Style, and Emphasis', 'sentence style', 'Syntax, punctuation, voice, and deliberate repetition shape emphasis and rhythm.', 'A short sentence after long ones can create impact.', 'Revise a paragraph for deliberate emphasis.'],
      ['Research Questions and Sources', 'research process', 'Focused questions guide ethical search, source evaluation, note-taking, and citation.', 'A researchable question is specific enough to investigate with evidence.', 'Narrow a broad topic into a workable question.'],
      ['Claims, Counterclaims, and Evidence', 'argumentation', 'Strong arguments address counterclaims and weigh quality, relevance, and sufficiency of evidence.', 'Acknowledging a limitation can strengthen credibility.', 'Build an argument map with a counterclaim.'],
      ['Media and Information Literacy', 'media literacy', 'Authorship, purpose, framing, algorithms, and verification affect information reliability.', 'A cropped image can remove context and alter interpretation.', 'Verify one circulating claim using independent sources.'],
    ],
  },
  10: {
    science: [
      ['Plate Tectonics and Earth History', 'plate tectonics', 'Plate motion, rock evidence, fossils, and geologic structures explain Earth changing history.', 'Matching fossils across continents support past continental connections.', 'Synthesize three evidence types for plate movement.'],
      ['Climate Change Evidence and Response', 'climate change', 'Multiple long-term data sets reveal climate trends, impacts, mitigation, and adaptation choices.', 'Rising average sea level is measured across decades, not one tide.', 'Evaluate a local adaptation option using evidence and tradeoffs.'],
      ['Electricity and Magnetism', 'electromagnetism', 'Electric current creates magnetic fields, and changing magnetic fields can induce current.', 'A current-carrying coil can act as an electromagnet.', 'Investigate variables that change electromagnet strength.'],
      ['Light, Mirrors, and Lenses', 'optics', 'Reflection and refraction models explain image formation in mirrors and lenses.', 'A convex lens can converge parallel light rays.', 'Ray-trace an image and test a lens prediction.'],
      ['Biodiversity and Conservation', 'biodiversity', 'Genetic, species, and ecosystem diversity support resilience and human well-being.', 'Habitat fragmentation can isolate populations and reduce gene flow.', 'Prioritize conservation actions for a local habitat.'],
      ['Biotechnology and Society', 'biotechnology', 'Biotechnology applies cellular and genetic knowledge while raising evidence, ethics, and access questions.', 'Microorganisms can produce useful foods and medicines.', 'Evaluate benefits, risks, and safeguards in one application.'],
    ],
    math: [
      ['Sequences and Series', 'sequences', 'Arithmetic and geometric patterns can be represented recursively and explicitly.', 'An arithmetic sequence adds a constant common difference.', 'Model savings growth with a sequence.'],
      ['Polynomial Functions', 'polynomials', 'Degree, zeros, factors, end behavior, and graphs describe polynomial relationships.', 'A zero corresponds to an x-intercept and a linear factor.', 'Connect a factored polynomial to its graph.'],
      ['Circles and Geometric Relationships', 'circle geometry', 'Arcs, chords, tangents, secants, and angles satisfy connected theorems.', 'A radius to a tangent point is perpendicular to the tangent.', 'Solve and justify a circle-angle problem.'],
      ['Coordinate and Analytic Geometry', 'analytic geometry', 'Equations and coordinates model lines, circles, distances, and loci.', 'The standard circle equation identifies center and radius.', 'Derive an equation from geometric conditions.'],
      ['Counting and Probability', 'counting principles', 'Permutations, combinations, and probability rules count structured outcomes.', 'Order matters in a permutation but not in a combination.', 'Choose and justify a counting method for two scenarios.'],
      ['Financial Planning and Models', 'financial modeling', 'Growth rates, interest, annuities, inflation, and constraints support long-term decisions.', 'Compound interest earns returns on earlier interest.', 'Compare savings plans using assumptions and total value.'],
    ],
    english: [
      ['World Literature and Context', 'contextual reading', 'Historical, cultural, and authorial contexts inform interpretation without replacing textual evidence.', 'A symbol may carry different meanings across cultures.', 'Connect one text detail to relevant context.'],
      ['Critical Reading and Ideology', 'critical reading', 'Readers examine assumptions, power, representation, and silenced perspectives in texts.', 'Word choice can frame one group as active and another as passive.', 'Analyze framing in two accounts of an event.'],
      ['Advanced Argumentation', 'reasoned argument', 'Nuanced claims qualify scope, synthesize evidence, address counterarguments, and avoid fallacies.', 'A causal claim requires more than simple correlation.', 'Audit an argument for assumptions and fallacies.'],
      ['Research Synthesis and Citation', 'research synthesis', 'Synthesis combines patterns and tensions across credible sources with ethical attribution.', 'A synthesis paragraph organizes ideas, not one source at a time.', 'Create a source matrix and draft a synthesis.'],
      ['Multimodal and Digital Texts', 'multimodal literacy', 'Layout, image, sound, interaction, and data visualization shape digital meaning.', 'A graph scale can visually exaggerate a small change.', 'Evaluate how design choices affect one infographic.'],
      ['Speaking for Public Audiences', 'public speaking', 'Structure, evidence, vocal delivery, visuals, and response to questions build credible presentations.', 'A clear signpost helps listeners follow a complex explanation.', 'Plan and rehearse a three-minute evidence-based talk.'],
    ],
  },
};

await rm(SEED_ROOT, { recursive: true, force: true });
await mkdir(SEED_ROOT, { recursive: true });
await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });

const registry = [];
await generateGrade(1);
await validateGradeOne();
for (let grade = 2; grade <= 10; grade += 1) {
  await generateGrade(grade);
}
await writeRegistry();

console.log(
  `Generated ${registry.length} static modules and ${registry.length * 2} WebP teaching aids.`,
);

async function generateGrade(grade) {
  for (const subject of Object.keys(SUBJECT_META)) {
    const topics = CURRICULUM[grade][subject];
    if (topics.length < 5 || topics.length > 7) {
      throw new Error(`Grade ${grade} ${subject} must have 5-7 modules.`);
    }
    for (const [index, topic] of topics.entries()) {
      await generateModule(grade, subject, index + 1, topic);
    }
  }
}

async function generateModule(grade, subject, number, topic) {
  const [title, concept, definition, example, activity] = topic;
  const subjectMeta = SUBJECT_META[subject];
  const slug = slugify(title);
  const moduleId = `g${grade}-${subject}-${String(number).padStart(2, '0')}-${slug}`;
  const quizId = `${moduleId}-quiz`;
  const moduleDir = path.join(
    SEED_ROOT,
    `grade${grade}`,
    subject,
    moduleId,
  );
  const imagesDir = path.join(moduleDir, 'images');
  await mkdir(imagesDir, { recursive: true });

  const keyword = concept.split(/\s+/).slice(0, 3).join(' ');
  const markdown = buildMarkdown({
    grade,
    subject,
    title,
    concept,
    definition,
    example,
    activity,
  });
  const quiz = buildQuiz({
    moduleId,
    title,
    concept,
    definition,
    example,
    activity,
  });
  const reviewItems = buildReviewItems({
    moduleId,
    title,
    concept,
    definition,
    example,
    activity,
  });
  const conceptImagePath = path.join(imagesDir, 'concept-guide.webp');
  const exampleImagePath = path.join(imagesDir, 'worked-example.webp');
  await renderTeachingAid({
    outputPath: conceptImagePath,
    grade,
    subject,
    title,
    eyebrow: `${subjectMeta.icon} • GRADE ${grade}`,
    headline: concept,
    lines: splitForVisual(definition),
    mode: 'concept',
  });
  await renderTeachingAid({
    outputPath: exampleImagePath,
    grade,
    subject,
    title,
    eyebrow: 'SEE • THINK • TRY',
    headline: keyword,
    lines: [example, activity],
    mode: 'example',
  });

  const markdownPath = 'lesson.md';
  const quizPath = `${quizId}.json`;
  const files = {
    [markdownPath]: Buffer.from(markdown),
    [quizPath]: Buffer.from(`${JSON.stringify(quiz, null, 2)}\n`),
    'images/concept-guide.webp': await import('node:fs/promises').then(
      ({ readFile }) => readFile(conceptImagePath),
    ),
    'images/worked-example.webp': await import('node:fs/promises').then(
      ({ readFile }) => readFile(exampleImagePath),
    ),
  };
  const checksums = Object.fromEntries(
    Object.entries(files).map(([name, bytes]) => [
      name,
      `sha256:${sha256(bytes)}`,
    ]),
  );
  const manifest = {
    moduleId,
    version: 1,
    contentCategory: 'teacherModule',
    source: 'seed-bundle',
    gradeLevel: grade,
    subject: subjectMeta.appSubject,
    content: { markdown: markdownPath },
    assets: ['images/concept-guide.webp', 'images/worked-example.webp'],
    checksums,
    quizId,
    reviewItems,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const archiveEntries = {
    ...Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [
        name,
        new Uint8Array(bytes),
      ]),
    ),
    'manifest.json': strToU8(JSON.stringify(manifest)),
  };
  const archive = zipSync(archiveEntries, { level: 7 });

  await writeFile(path.join(moduleDir, markdownPath), markdown);
  await writeFile(path.join(moduleDir, quizPath), `${JSON.stringify(quiz, null, 2)}\n`);
  await writeFile(path.join(moduleDir, 'manifest.json'), manifestBytes);
  await writeFile(path.join(moduleDir, `${moduleId}.wais-module`), archive);
  registry.push({
    grade,
    subject,
    title,
    moduleId,
    relativeArchive: path
      .relative(path.join(ROOT, 'src', 'seed'), path.join(moduleDir, `${moduleId}.wais-module`))
      .split(path.sep)
      .join('/'),
  });
}

function buildMarkdown({
  grade,
  subject,
  title,
  concept,
  definition,
  example,
  activity,
}) {
  const readingDepth =
    grade <= 2
      ? 'Say the key words aloud. Point to the visual as you explain what you notice.'
      : grade <= 6
        ? 'Connect the example to the key idea, then explain the connection in your own words.'
        : 'Use evidence from the model to explain the relationship, limitation, or pattern you observe.';
  const reasoning =
    grade <= 3
      ? `Ask: What changed? What stayed the same?`
      : grade <= 6
        ? `Ask: Which detail is evidence for the main idea, and how do you know?`
        : `Ask: What assumptions does the model make, and what evidence would strengthen the conclusion?`;
  return `# ${title}

> WAIS demo content aligned to MATATAG Quarter 1 learning goals. This is an original classroom learning aid, not official curriculum text.

## Learning goal

By the end of this lesson, you can explain **${concept}**, use it in a clear example, and apply the idea in a short task.

![Concept guide for ${title}](images/concept-guide.webp)

## Key idea

\`${concept}\` is the focus of this lesson. ${definition}

${readingDepth}

## Worked example

${example}

Notice how the example supports the key idea instead of simply naming it. ${reasoning}

![Worked example for ${title}](images/worked-example.webp)

## Guided practice

1. Restate the key idea in your own words.
2. Identify the important information in the worked example.
3. Complete this task: ${activity}
4. Check your answer by returning to the definition and visual.

## Talk and think

- What detail was most useful?
- What is one common mistake someone might make?
- Where could you observe or use this idea at home, in school, or in the community?

## Remember

The goal is not only to memorize **${concept}**. You should be able to recognize it, explain it, and use it in a new situation.
`;
}

function buildQuiz({
  moduleId,
  title,
  concept,
  definition,
  example,
  activity,
}) {
  const shortDefinition = trimSentence(definition);
  const shortExample = trimSentence(example);
  return [
    {
      questionId: `${moduleId}-q1`,
      type: 'multiple-choice',
      prompt: `Which statement best explains ${concept}?`,
      options: [
        shortDefinition,
        `It is only the title of the lesson ${title}.`,
        'It is a detail that can never be observed or tested.',
        'It means every example must have the same answer.',
      ],
      correctAnswer: shortDefinition,
      conceptId: slugify(concept),
    },
    {
      questionId: `${moduleId}-q2`,
      type: 'multiple-choice',
      prompt: 'Which choice is the best worked example from this lesson?',
      options: [
        shortExample,
        'A statement with no connection to the key idea.',
        'A guess that ignores the information given.',
        'A list of words without an explanation.',
      ],
      correctAnswer: shortExample,
      conceptId: `${slugify(concept)}-application`,
    },
    {
      questionId: `${moduleId}-q3`,
      type: 'fill-in-the-blank',
      prompt: `Complete the lesson focus: We are learning about ______.`,
      correctAnswer: concept,
      conceptId: slugify(concept),
    },
    {
      questionId: `${moduleId}-q4`,
      type: 'identification',
      prompt: `Name the key concept that this task practices: ${activity}`,
      correctAnswer: concept,
      conceptId: `${slugify(concept)}-application`,
    },
    {
      questionId: `${moduleId}-q5`,
      type: 'identification',
      prompt: 'What should you use to support an explanation after completing the task?',
      correctAnswer: 'evidence',
      conceptId: `${slugify(concept)}-reasoning`,
    },
  ];
}

function buildReviewItems({
  moduleId,
  title,
  concept,
  definition,
  example,
  activity,
}) {
  const authoredBy = 'curriculum:wais-demo-q1';
  const base = {
    moduleId,
    moduleVersion: 1,
    authoredBy,
    tags: ['demo', 'matatag-aligned', 'quarter-1'],
  };
  return [
    {
      ...base,
      itemId: `${moduleId}-review-1`,
      conceptId: slugify(concept),
      type: 'flashcard',
      importance: 'core',
      prompt: `What is ${concept}?`,
      answer: trimSentence(definition),
      formats: { text: definition, visual: 'images/concept-guide.webp' },
    },
    {
      ...base,
      itemId: `${moduleId}-review-2`,
      conceptId: `${slugify(concept)}-example`,
      type: 'flashcard',
      importance: 'core',
      prompt: `Give the lesson example for ${concept}.`,
      answer: trimSentence(example),
      formats: { text: example, visual: 'images/worked-example.webp' },
    },
    {
      ...base,
      itemId: `${moduleId}-review-3`,
      conceptId: slugify(concept),
      type: 'quiz-question',
      importance: 'core',
      prompt: `Identify the main concept in ${title}.`,
      answer: concept,
      formats: { text: concept },
    },
    {
      ...base,
      itemId: `${moduleId}-review-4`,
      conceptId: `${slugify(concept)}-summary`,
      type: 'concept-summary',
      importance: 'supplementary',
      prompt: `Explain ${concept} in one or two clear sentences.`,
      answer: trimSentence(definition),
      formats: { text: definition },
    },
    {
      ...base,
      itemId: `${moduleId}-review-5`,
      conceptId: `${slugify(concept)}-transfer`,
      type: 'concept-summary',
      importance: 'stretch',
      prompt: `How would you complete this task and check your reasoning? ${activity}`,
      answer:
        'Complete the task, compare the result with the key idea, and cite evidence from the example or visual.',
      formats: { text: activity },
    },
  ];
}

async function renderTeachingAid({
  outputPath,
  grade,
  subject,
  title,
  eyebrow,
  headline,
  lines,
  mode,
}) {
  const meta = SUBJECT_META[subject];
  const safeTitle = escapeXml(title);
  const safeHeadline = escapeXml(headline);
  const wrappedTitle = wrapText(safeTitle, 34);
  const wrappedHeadline = wrapText(safeHeadline, 28);
  const lineBlocks = lines
    .flatMap((line) => wrapText(escapeXml(line), 56))
    .slice(0, 6);
  const subjectGraphic =
    subject === 'science'
      ? scienceGraphic(meta.color, mode)
      : subject === 'math'
        ? mathGraphic(meta.color, mode)
        : englishGraphic(meta.color, mode);
  const titleText = wrappedTitle
    .map(
      (line, index) =>
        `<text x="54" y="${112 + index * 38}" class="title">${line}</text>`,
    )
    .join('');
  const headlineY = 174 + Math.max(0, wrappedTitle.length - 1) * 38;
  const headlineText = wrappedHeadline
    .map(
      (line, index) =>
        `<text x="54" y="${headlineY + index * 33}" class="headline">${line}</text>`,
    )
    .join('');
  const bodyY = headlineY + wrappedHeadline.length * 34 + 34;
  const bodyText = lineBlocks
    .map(
      (line, index) =>
        `<circle cx="63" cy="${bodyY - 6 + index * 30}" r="5" fill="${meta.color}"/>
         <text x="80" y="${bodyY + index * 30}" class="body">${line}</text>`,
    )
    .join('');
  const svg = `<svg width="900" height="560" viewBox="0 0 900 560" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="560" fill="${meta.tint}"/>
    <rect x="24" y="24" width="852" height="512" rx="18" fill="#FFFFFF" stroke="${meta.color}" stroke-width="3"/>
    <rect x="54" y="42" width="300" height="30" rx="15" fill="${meta.color}"/>
    <text x="74" y="63" class="eyebrow">${escapeXml(eyebrow)}</text>
    ${titleText}
    ${headlineText}
    ${bodyText}
    ${subjectGraphic}
    <text x="54" y="510" class="footer">WAIS • Grade ${grade} • MATATAG-aligned demo content</text>
    <style>
      .eyebrow { font: 700 14px Arial, sans-serif; fill: #FFFFFF; letter-spacing: 1px; }
      .title { font: 800 30px Arial, sans-serif; fill: #111827; }
      .headline { font: 800 24px Arial, sans-serif; fill: ${meta.color}; }
      .body { font: 500 18px Arial, sans-serif; fill: #374151; }
      .footer { font: 600 14px Arial, sans-serif; fill: #6B7280; }
    </style>
  </svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(outputPath);
}

function scienceGraphic(color, mode) {
  return mode === 'concept'
    ? `<circle cx="720" cy="185" r="62" fill="${color}" opacity=".14"/>
       <circle cx="720" cy="185" r="34" fill="${color}"/>
       <path d="M720 151v68M686 185h68" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
       <path d="M650 300c45-44 95-44 140 0M660 342c38-32 82-32 120 0" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`
    : `<path d="M650 330c15-80 55-135 120-165" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
       <circle cx="650" cy="330" r="22" fill="${color}"/><circle cx="710" cy="245" r="22" fill="${color}"/><circle cx="770" cy="165" r="22" fill="${color}"/>
       <text x="638" y="375" font-family="Arial" font-size="18" font-weight="700" fill="${color}">observe → explain</text>`;
}

function mathGraphic(color, mode) {
  return mode === 'concept'
    ? `<line x1="625" y1="330" x2="820" y2="330" stroke="${color}" stroke-width="8"/>
       ${[0, 1, 2, 3, 4].map((i) => `<line x1="${625 + i * 49}" y1="315" x2="${625 + i * 49}" y2="345" stroke="${color}" stroke-width="6"/>`).join('')}
       <rect x="650" y="165" width="70" height="70" fill="${color}" opacity=".22"/>
       <circle cx="785" cy="200" r="38" fill="${color}" opacity=".72"/>`
    : `<rect x="625" y="150" width="190" height="210" rx="12" fill="none" stroke="${color}" stroke-width="8"/>
       <line x1="650" y1="205" x2="790" y2="205" stroke="${color}" stroke-width="6"/>
       <line x1="650" y1="255" x2="790" y2="255" stroke="${color}" stroke-width="6"/>
       <line x1="650" y1="305" x2="790" y2="305" stroke="${color}" stroke-width="6"/>
       <text x="662" y="190" font-family="Arial" font-size="20" font-weight="700" fill="${color}">model</text>`;
}

function englishGraphic(color, mode) {
  return mode === 'concept'
    ? `<path d="M630 165h80c25 0 45 20 45 45v145c-18-12-37-18-57-18h-68z" fill="${color}" opacity=".22" stroke="${color}" stroke-width="6"/>
       <path d="M755 210c0-25 20-45 45-45h40v172h-28c-20 0-39 6-57 18z" fill="${color}" opacity=".12" stroke="${color}" stroke-width="6"/>
       <text x="660" y="255" font-family="Arial" font-size="48" font-weight="800" fill="${color}">Aa</text>`
    : `<rect x="625" y="160" width="210" height="58" rx="12" fill="${color}" opacity=".18"/>
       <rect x="625" y="238" width="170" height="58" rx="12" fill="${color}" opacity=".32"/>
       <rect x="625" y="316" width="125" height="58" rx="12" fill="${color}" opacity=".52"/>
       <text x="650" y="198" font-family="Arial" font-size="19" font-weight="700" fill="${color}">idea</text>
       <text x="650" y="276" font-family="Arial" font-size="19" font-weight="700" fill="${color}">detail</text>
       <text x="650" y="354" font-family="Arial" font-size="19" font-weight="700" fill="#fff">meaning</text>`;
}

async function validateGradeOne() {
  const gradeOne = registry.filter((item) => item.grade === 1);
  if (gradeOne.length !== 18) {
    throw new Error(`Grade 1 proof must contain 18 modules, found ${gradeOne.length}.`);
  }
  for (const item of gradeOne) {
    const moduleDir = path.dirname(
      path.resolve(path.join(ROOT, 'src', 'seed'), item.relativeArchive),
    );
    const { readFile } = await import('node:fs/promises');
    const manifest = JSON.parse(await readFile(path.join(moduleDir, 'manifest.json'), 'utf8'));
    const quiz = JSON.parse(
      await readFile(path.join(moduleDir, `${manifest.quizId}.json`), 'utf8'),
    );
    if (
      manifest.assets.length < 2 ||
      manifest.reviewItems.length < 5 ||
      quiz.length < 5
    ) {
      throw new Error(`Grade 1 module ${manifest.moduleId} is incomplete.`);
    }
    for (const asset of manifest.assets) {
      const metadata = await sharp(path.join(moduleDir, asset)).metadata();
      if (
        metadata.format !== 'webp' ||
        !metadata.width ||
        metadata.width > 1080
      ) {
        throw new Error(`Invalid Grade 1 teaching aid: ${asset}`);
      }
    }
  }
  console.log('Grade 1 proof validated: 18 complete modules.');
}

async function writeRegistry() {
  const lines = [
    '/* This file is generated by scripts/generate-seed-bundles.mjs. */',
    '',
    'export interface BundledModuleAsset {',
    '  gradeLevel: number;',
    "  subject: 'SCIENCE' | 'MATH' | 'ENGLISH';",
    '  moduleId: string;',
    '  title: string;',
    '  archiveAsset: number;',
    '}',
    '',
    'export const BUNDLED_MODULES: BundledModuleAsset[] = [',
  ];
  for (const item of registry) {
    lines.push(
      `  { gradeLevel: ${item.grade}, subject: '${SUBJECT_META[item.subject].appSubject}', moduleId: '${item.moduleId}', title: ${JSON.stringify(item.title)}, archiveAsset: require(${JSON.stringify(item.relativeArchive)}) },`,
    );
  }
  lines.push('];', '');
  await writeFile(REGISTRY_PATH, `${lines.join('\n')}\n`);
}

function splitForVisual(value) {
  const clauses = value
    .split(/[.;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return clauses.length >= 2 ? clauses : [value];
}

function wrapText(value, maxLength) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function trimSentence(value) {
  return value.trim().replace(/[.!?]+$/, '');
}

function slugify(value) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
