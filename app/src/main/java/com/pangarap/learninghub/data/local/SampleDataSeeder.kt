package com.pangarap.learninghub.data.local

import com.pangarap.learninghub.domain.MasteryLevel
import com.pangarap.learninghub.domain.ProgressStatus
import com.pangarap.learninghub.domain.QuestionType
import com.pangarap.learninghub.domain.SubjectType

class SampleDataSeeder(private val db: LearningHubDatabase) {
    suspend fun seedIfNeeded() {
        val now = System.currentTimeMillis()
        val modules = curriculumModules()
        val questions = scienceQuestions() + mathQuestions() + englishQuestions()

        db.moduleDao().insertAll(modules)
        db.quizQuestionDao().insertAll(questions)

        if (db.studentDao().count() > 0) return

        val students = listOf(
            StudentEntity("student_ana", "2026-0001", "Ana", "Reyes", "L", "Ana Reyes", 5, "Mabini", "2015-04-12", "", "1111", 0xFF0F766EL),
            StudentEntity("student_ben", "2026-0002", "Ben", "Santos", "R", "Ben Santos", 5, "Mabini", "2015-06-20", "", "2222", 0xFF2563EBL),
            StudentEntity("student_carla", "2026-0003", "Carla", "Dizon", "M", "Carla Dizon", 5, "Mabini", "2015-09-03", "", "3333", 0xFF9333EAL),
            StudentEntity("student_dan", "2026-0004", "Dan", "Cruz", "A", "Dan Cruz", 5, "Mabini", "2015-11-18", "", "4444", 0xFFCA8A04L),
            StudentEntity("student_ella", "2026-0005", "Ella", "Garcia", "P", "Ella Garcia", 5, "Mabini", "2015-02-07", "", "5555", 0xFF16A34AL),
            StudentEntity("student_felix", "2026-0006", "Felix", "Lim", "S", "Felix Lim", 5, "Mabini", "2015-12-01", "", "6666", 0xFFEA580CL)
        )

        val attempts = listOf(
            QuizAttemptEntity("seed_ana_sci", "student_ana", "sci_g5_q1_m1", 5, 5, "Ready for next challenge", "Scientific observation", MasteryLevel.ADVANCED.name, 240, 1, now - 86_400_000),
            QuizAttemptEntity("seed_ben_sci", "student_ben", "sci_g5_q1_m1", 3, 5, "Observing material properties", "Absorption", MasteryLevel.DEVELOPING.name, 360, 1, now - 76_400_000),
            QuizAttemptEntity("seed_carla_sci", "student_carla", "sci_g5_q1_m1", 2, 5, "Choosing suitable materials", "Texture", MasteryLevel.BEGINNER.name, 410, 1, now - 66_400_000),
            QuizAttemptEntity("seed_dan_eng", "student_dan", "eng_g5_q1_m1", 4, 5, "Finding supporting details", "Finding main idea", MasteryLevel.PROFICIENT.name, 290, 1, now - 56_400_000),
            QuizAttemptEntity("seed_ella_math", "student_ella", "math_g5_q1_m1", 5, 5, "Ready for next challenge", "Adding like fractions", MasteryLevel.ADVANCED.name, 260, 1, now - 46_400_000),
            QuizAttemptEntity("seed_felix_math", "student_felix", "math_g5_q1_m1", 1, 5, "Subtracting like fractions", "Fraction vocabulary", MasteryLevel.BEGINNER.name, 480, 1, now - 36_400_000)
        )
        val progress = attempts.map {
            ProgressEntity(
                id = "${it.studentId}-${it.moduleId}",
                studentId = it.studentId,
                moduleId = it.moduleId,
                status = ProgressStatus.COMPLETED.name,
                masteryLevel = when {
                    it.score >= 5 -> MasteryLevel.ADVANCED.name
                    it.score >= 4 -> MasteryLevel.PROFICIENT.name
                    it.score >= 3 -> MasteryLevel.DEVELOPING.name
                    else -> MasteryLevel.BEGINNER.name
                },
                updatedAt = it.submittedAt
            )
        }

        db.studentDao().insertAll(students)
        db.quizAttemptDao().insertAll(attempts)
        db.progressDao().upsertAll(progress)
        db.lessonPlanDao().insertAll(
            listOf(
                LessonPlanEntity(
                    id = "seed_plan_materials",
                    title = "Intervention: Observing Material Properties",
                    subject = SubjectType.SCIENCE.name,
                    gradeLevel = 5,
                    competencyCode = "MATATAG-SCI5-MATTER-Q1-M1",
                    topic = "Properties of Materials",
                    generatedContent = "Objectives: Identify observable properties of common materials.\n\nMaterials: Paper, cloth, spoon, rubber band, cup of water.\n\nLesson Flow: Observe, sort, explain, and compare materials.\n\nAssessment: Exit ticket with two examples of suitable materials.\n\nRemediation: Pair learners and let them explain one property using a real object.",
                    createdAt = now - 26_400_000
                )
            )
        )
    }

    private fun curriculumModules() = listOf(
            ModuleEntity(
                id = "sci_g5_q1_m1",
                title = "Properties of Materials",
                subject = SubjectType.SCIENCE.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-SCI5-MATTER-Q1-M1",
                content = """
                    Objectives:
                    - Describe common materials using observable properties.
                    - Choose a suitable material for a purpose and support the choice with evidence.

                    Vocabulary:
                    - Hardness: how well a material resists scratching, bending, or breaking.
                    - Flexibility: how easily a material bends without breaking.
                    - Absorbency: how well a material takes in water or liquid.
                    - Waterproof: able to keep water from passing through.

                    Key Ideas:
                    - Materials have observable properties: hardness, flexibility, texture, absorbency, waterproofing, and whether they float or sink.
                    - A good material matches the job it needs to do. A raincoat should resist water, a towel should absorb water, and a chair should stay strong under weight.
                    - Scientists compare materials by testing one property at a time, recording evidence, and choosing the safest useful option.

                    Worked Example:
                    If a class needs a bag for wet swimsuits, plastic-lined cloth is better than paper because it is flexible, stronger when wet, and slows leaking.

                    Try This:
                    Sort five objects at home by one property. Explain which object is best for carrying, covering, or cleaning, and name the evidence you used.

                    Quick Check:
                    - Which property matters most for a raincoat?
                    - Why is evidence better than guessing when choosing a material?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "sci_g5_q1_m2",
                title = "Changes in Matter",
                subject = SubjectType.SCIENCE.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-SCI5-MATTER-Q1-M2",
                content = """
                    Objectives:
                    - Distinguish physical changes from chemical changes.
                    - Use clues such as new color, smell, gas, heat, or ash to explain a change in matter.

                    Vocabulary:
                    - Physical change: a change in size, shape, or state without making a new substance.
                    - Chemical change: a change that forms one or more new substances.
                    - State: the form of matter, such as solid, liquid, or gas.

                    Key Ideas:
                    - Matter can change in size, shape, temperature, or state. Melting, freezing, tearing, folding, and dissolving usually change appearance without making a new substance.
                    - A physical change keeps the material's identity. Ice that melts is still water, and paper cut into strips is still paper.
                    - A chemical change forms a new substance. Burning, rusting, spoiling, and cooking can create new color, smell, gas, heat, or ash.

                    Worked Example:
                    Melting chocolate is a physical change because it can harden again. Burning wood is a chemical change because ash and smoke are formed.

                    Try This:
                    List three changes you see in the kitchen or classroom. Label each as physical or chemical and give one clue for your answer.

                    Quick Check:
                    - Is freezing water physical or chemical? Why?
                    - Name one sign that a new substance may have formed.
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "sci_g5_q1_m3",
                title = "Body Systems Working Together",
                subject = SubjectType.SCIENCE.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-SCI5-LIFE-Q1-M3",
                content = """
                    Objectives:
                    - Identify major body systems and their jobs.
                    - Explain how at least three body systems work together during an everyday activity.

                    Vocabulary:
                    - Digestive system: breaks food into nutrients the body can use.
                    - Respiratory system: brings oxygen into the body and removes carbon dioxide.
                    - Circulatory system: carries oxygen, nutrients, and wastes through the blood.
                    - Nervous system: sends messages that help the body respond.

                    Key Ideas:
                    - Body systems work together so the body can get energy, move materials, remove wastes, and respond to changes.
                    - The digestive system breaks food into nutrients. The respiratory system brings oxygen into the lungs. The circulatory system moves oxygen and nutrients through the blood.
                    - The nervous system sends messages that help the body react, while muscles and bones support movement.

                    Worked Example:
                    During a run, breathing becomes faster, the heart pumps more blood, muscles use more energy, and the brain helps keep balance.

                    Try This:
                    Trace what happens after you eat a banana before playtime. Name at least three systems and explain the job each one does.

                    Quick Check:
                    - Which system moves blood around the body?
                    - Why does breathing change when a person exercises?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "sci_g5_q1_m4",
                title = "Ecosystems and Food Chains",
                subject = SubjectType.SCIENCE.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-SCI5-LIFE-Q1-M4",
                content = """
                    Objectives:
                    - Identify living and nonliving parts of an ecosystem.
                    - Build a food chain that shows how energy moves from producers to consumers and decomposers.

                    Vocabulary:
                    - Ecosystem: living and nonliving parts interacting in one environment.
                    - Producer: an organism, usually a plant, that makes its own food.
                    - Consumer: an organism that gets energy by eating plants or animals.
                    - Decomposer: an organism that breaks down dead matter and returns nutrients to soil.

                    Key Ideas:
                    - An ecosystem includes living things, such as plants, animals, fungi, and bacteria, plus nonliving parts, such as sunlight, water, air, soil, and rocks.
                    - Energy usually begins with the Sun. Producers make food, consumers eat plants or animals, and decomposers break down dead matter.
                    - A change in one part of an ecosystem can affect many others, especially when food, shelter, or clean water becomes limited.

                    Worked Example:
                    In a garden food chain, grass uses sunlight, a grasshopper eats grass, a frog eats the grasshopper, and decomposers return nutrients to the soil.

                    Try This:
                    Draw a local food chain with at least four parts. Circle the producer and underline the decomposer.

                    Quick Check:
                    - What is the first energy source in many food chains?
                    - What might happen if one consumer disappears from an ecosystem?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "math_g5_q1_m1",
                title = "Adding and Subtracting Fractions",
                subject = SubjectType.MATH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-MATH5-FRACTIONS-Q1-M1",
                content = """
                    Objectives:
                    - Add and subtract fractions with the same denominator.
                    - Explain answers using models, number lines, or word-problem reasoning.

                    Vocabulary:
                    - Numerator: the top number that tells how many parts are counted.
                    - Denominator: the bottom number that tells how many equal parts make one whole.
                    - Like fractions: fractions that have the same denominator.

                    Key Ideas:
                    - Like fractions have the same denominator, so their parts are the same size. Add or subtract the numerators and keep the denominator.
                    - The denominator names the size of the equal parts. The numerator tells how many of those parts are being used.
                    - Models, strips, number lines, and word problems help check whether an answer is reasonable.

                    Worked Example:
                    2/8 + 3/8 = 5/8 because two eighths and three eighths make five eighths. 7/10 - 2/10 = 5/10 because five tenths remain.

                    Try This:
                    Create a story problem for 4/12 + 5/12. Solve it, then draw a model that proves your answer.

                    Quick Check:
                    - Why does the denominator stay the same when adding like fractions?
                    - What model could show 7/10 - 2/10?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "math_g5_q1_m2",
                title = "Multiplying Fractions",
                subject = SubjectType.MATH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-MATH5-FRACTIONS-Q1-M2",
                content = """
                    Objectives:
                    - Multiply fractions and whole numbers by fractions.
                    - Use area models to show why fraction multiplication works.

                    Vocabulary:
                    - Factor: a number being multiplied.
                    - Product: the answer to a multiplication problem.
                    - Simplify: rename a fraction in an equivalent form with smaller numbers.

                    Key Ideas:
                    - Multiplying fractions can mean finding a part of a part, such as 1/2 of 1/3.
                    - Multiply the numerators, multiply the denominators, then simplify when possible.
                    - A product of two proper fractions is smaller than either factor because the answer is only a part of a part.

                    Worked Example:
                    1/2 x 1/3 = 1/6. A rectangle split into thirds one way and halves the other way shows six equal parts with one shaded overlap.

                    Try This:
                    Draw a model for 2/3 x 3/4. Write the product before simplifying and explain what each shaded part represents.

                    Quick Check:
                    - What is 1/2 of 8?
                    - Why is 1/2 x 1/3 smaller than 1/2?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "math_g5_q1_m3",
                title = "Decimals and Place Value",
                subject = SubjectType.MATH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-MATH5-DECIMALS-Q1-M3",
                content = """
                    Objectives:
                    - Read, write, compare, and order decimals through thousandths.
                    - Connect decimals to fractions using place value.

                    Vocabulary:
                    - Tenths: ten equal parts of one whole.
                    - Hundredths: one hundred equal parts of one whole.
                    - Thousandths: one thousand equal parts of one whole.
                    - Equivalent: having the same value even if written differently.

                    Key Ideas:
                    - Decimals show parts of one whole using place value. The first digit after the decimal point is tenths, the next is hundredths, and the next is thousandths.
                    - Decimals and fractions can name the same amount: 0.5 = 5/10 and 0.35 = 35/100.
                    - To compare decimals, line up decimal points and compare digits from left to right. Extra zeros at the end do not change the value.

                    Worked Example:
                    0.5 is greater than 0.45 because 0.50 has five tenths and 0.45 has four tenths.

                    Try This:
                    Order 0.7, 0.07, 0.70, and 0.707 from least to greatest, then explain your place-value reasoning.

                    Quick Check:
                    - Which is greater, 0.405 or 0.45? Explain.
                    - Write 35 hundredths as a decimal and as a fraction.
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "math_g5_q1_m4",
                title = "Area and Perimeter",
                subject = SubjectType.MATH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-MATH5-MEASUREMENT-Q1-M4",
                content = """
                    Objectives:
                    - Find the perimeter and area of rectangles.
                    - Decide whether a problem is asking for distance around or space inside.

                    Vocabulary:
                    - Perimeter: the total distance around a shape.
                    - Area: the amount of space inside a flat shape.
                    - Square unit: a unit used to measure area, such as square cm or square m.

                    Key Ideas:
                    - Perimeter is the distance around a shape. Add all side lengths and use linear units such as cm or m.
                    - Area is the space inside a flat shape. Count square units or multiply length x width for rectangles.
                    - Two rectangles can have the same area but different perimeters, so always check what the problem is asking.

                    Worked Example:
                    A rectangle that is 6 cm by 4 cm has perimeter 20 cm because 6 + 4 + 6 + 4 = 20. Its area is 24 square cm because 6 x 4 = 24.

                    Try This:
                    Design a garden with an area of 24 square meters. Find two possible side lengths and compare their perimeters.

                    Quick Check:
                    - What units should be used for area?
                    - How can two rectangles have the same area but different perimeters?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "eng_g5_q1_m1",
                title = "Main Idea and Supporting Details",
                subject = SubjectType.ENGLISH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-ENG5-MAINIDEA-Q1-M1",
                content = """
                    Objectives:
                    - Identify the main idea of a paragraph or short text.
                    - Select supporting details that prove or explain the main idea.

                    Vocabulary:
                    - Main idea: what a text or paragraph is mostly about.
                    - Supporting detail: a fact, example, reason, or description that explains the main idea.
                    - Topic: the subject being discussed.

                    Key Ideas:
                    - The main idea tells what a paragraph or text is mostly about. It is wider than one detail but narrower than the whole subject.
                    - Supporting details explain, prove, describe, or give examples that connect back to the main idea.
                    - A strong reader asks: What do most sentences point to? Which detail best proves that idea?

                    Worked Example:
                    If a paragraph says roots absorb water, stems carry water, leaves use sunlight, and seeds grow new plants, the main idea may be that plant parts have important jobs.

                    Try This:
                    Read a short paragraph. Underline three supporting details, then write one sentence that states the main idea.

                    Quick Check:
                    - Can one tiny example be the main idea? Why or why not?
                    - What question helps you find the main idea?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "eng_g5_q1_m2",
                title = "Context Clues",
                subject = SubjectType.ENGLISH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-ENG5-VOCABULARY-Q1-M2",
                content = """
                    Objectives:
                    - Infer the meaning of unfamiliar words using context clues.
                    - Identify the type of clue used in a sentence or paragraph.

                    Vocabulary:
                    - Context: the words and ideas around an unfamiliar word.
                    - Synonym clue: a clue that gives a similar meaning.
                    - Antonym clue: a clue that gives an opposite meaning.
                    - Definition clue: a clue that directly explains the word.

                    Key Ideas:
                    - Context clues are nearby words, phrases, or sentences that help readers infer the meaning of an unfamiliar word.
                    - Clues can appear as definitions, examples, synonyms, antonyms, explanations, or cause-and-effect hints.
                    - Good readers reread the sentence, test a possible meaning, and check whether it makes sense in the whole paragraph.

                    Worked Example:
                    In "The trail was damp, or slightly wet, after the rain," the phrase "slightly wet" defines damp.

                    Try This:
                    Choose three unfamiliar words from a story or article. Copy the sentence, circle the clue, and write your inferred meaning.

                    Quick Check:
                    - What type of clue uses an opposite word?
                    - Why should readers check the whole sentence after guessing a word meaning?
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "eng_g5_q1_m3",
                title = "Fact and Opinion",
                subject = SubjectType.ENGLISH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-ENG5-READING-Q1-M3",
                content = """
                    Objectives:
                    - Distinguish facts from opinions in reading selections.
                    - Support facts with evidence and identify words that signal opinions.

                    Vocabulary:
                    - Fact: a statement that can be checked or proven.
                    - Opinion: a statement that tells a belief, feeling, preference, or judgment.
                    - Evidence: information that supports or proves a statement.

                    Key Ideas:
                    - A fact can be checked, measured, observed, or proven with reliable evidence.
                    - An opinion tells what someone thinks, feels, prefers, or believes. Words such as best, should, beautiful, boring, and favorite often signal opinions.
                    - Some opinions are stronger when supported by facts, but they are still opinions because people may disagree.

                    Worked Example:
                    "The school opens at 7:00" is a fact if the schedule confirms it. "Morning classes are better" is an opinion even if a reason is given.

                    Try This:
                    Write two facts and two opinions about your classroom. Add one piece of evidence for each fact.

                    Quick Check:
                    - Which words often signal an opinion?
                    - Can an opinion include a fact? Explain your answer.
                """.trimIndent(),
                isTeacherCreated = false
            ),
            ModuleEntity(
                id = "eng_g5_q1_m4",
                title = "Text Structure",
                subject = SubjectType.ENGLISH.name,
                gradeLevel = 5,
                quarter = 1,
                competencyCode = "MATATAG-ENG5-READING-Q1-M4",
                content = """
                    Objectives:
                    - Recognize common text structures in informational texts.
                    - Use signal words to follow and summarize a text.

                    Vocabulary:
                    - Sequence: ideas or events arranged in order.
                    - Cause and effect: why something happened and what happened because of it.
                    - Compare and contrast: how two or more things are alike and different.
                    - Problem and solution: an issue and one or more ways to address it.

                    Key Ideas:
                    - Authors organize ideas using text structures such as sequence, cause and effect, compare and contrast, problem and solution, and description.
                    - Signal words can reveal the structure: first, next, because, as a result, alike, however, problem, solution, and for example.
                    - Recognizing structure helps readers predict what comes next, take better notes, and find important information faster.

                    Worked Example:
                    A passage that explains why floods happen and what happens afterward uses cause and effect. A passage that lists steps for planting seeds uses sequence.

                    Try This:
                    Pick a paragraph from a science or English text. Name its structure, mark two signal words, and explain how the structure helps you understand it.

                    Quick Check:
                    - Which structure explains an issue and a fix?
                    - What signal words might show cause and effect?
                """.trimIndent(),
                isTeacherCreated = false
            )
        )

    private fun choices(vararg values: String): String =
        values.joinToString(prefix = "[\"", separator = "\",\"", postfix = "\"]")

    private fun scienceQuestions() = listOf(
        QuizQuestionEntity("sci_01", "sci_g5_q1_m1", QuestionType.MULTIPLE_CHOICE.name, "Which property describes how easily a material bends?", choices("Color", "Flexibility", "Size", "Taste"), "Flexibility", "Observing material properties"),
        QuizQuestionEntity("sci_02", "sci_g5_q1_m1", QuestionType.TRUE_FALSE.name, "A sponge absorbs water better than a metal spoon.", choices("True", "False"), "True", "Absorption"),
        QuizQuestionEntity("sci_03", "sci_g5_q1_m1", QuestionType.IDENTIFICATION.name, "What do we call the outside feel of a material, such as rough or smooth?", "", "texture", "Texture"),
        QuizQuestionEntity("sci_04", "sci_g5_q1_m1", QuestionType.MULTIPLE_CHOICE.name, "Which material is best for a raincoat?", choices("Paper", "Cotton cloth", "Plastic sheet", "Cardboard"), "Plastic sheet", "Choosing suitable materials"),
        QuizQuestionEntity("sci_05", "sci_g5_q1_m1", QuestionType.TRUE_FALSE.name, "Scientists should observe materials before choosing them for a product.", choices("True", "False"), "True", "Scientific observation"),
        QuizQuestionEntity("sci_06", "sci_g5_q1_m2", QuestionType.MULTIPLE_CHOICE.name, "Which change happens when ice becomes liquid water?", choices("Melting", "Burning", "Rusting", "Spoiling"), "Melting", "Changes of state"),
        QuizQuestionEntity("sci_07", "sci_g5_q1_m2", QuestionType.TRUE_FALSE.name, "Cutting paper changes its size and shape but does not make a new material.", choices("True", "False"), "True", "Physical changes"),
        QuizQuestionEntity("sci_08", "sci_g5_q1_m2", QuestionType.IDENTIFICATION.name, "What change forms new substances, such as ash when paper burns?", "", "chemical change", "Chemical changes"),
        QuizQuestionEntity("sci_09", "sci_g5_q1_m2", QuestionType.MULTIPLE_CHOICE.name, "Which is an example of a physical change?", choices("Burning wood", "Melting chocolate", "Cooking an egg", "Rusting iron"), "Melting chocolate", "Physical changes"),
        QuizQuestionEntity("sci_10", "sci_g5_q1_m2", QuestionType.TRUE_FALSE.name, "Freezing water is a change of state.", choices("True", "False"), "True", "Changes of state"),
        QuizQuestionEntity("sci_11", "sci_g5_q1_m3", QuestionType.MULTIPLE_CHOICE.name, "Which body system moves blood around the body?", choices("Digestive", "Circulatory", "Skeletal", "Integumentary"), "Circulatory", "Circulatory system"),
        QuizQuestionEntity("sci_12", "sci_g5_q1_m3", QuestionType.TRUE_FALSE.name, "The respiratory system helps the body get oxygen.", choices("True", "False"), "True", "Respiratory system"),
        QuizQuestionEntity("sci_13", "sci_g5_q1_m3", QuestionType.IDENTIFICATION.name, "Which system breaks food into nutrients the body can use?", "", "digestive system", "Digestive system"),
        QuizQuestionEntity("sci_14", "sci_g5_q1_m3", QuestionType.MULTIPLE_CHOICE.name, "Which system sends signals that help the body respond?", choices("Nervous system", "Digestive system", "Muscular system", "Respiratory system"), "Nervous system", "Nervous system"),
        QuizQuestionEntity("sci_15", "sci_g5_q1_m3", QuestionType.TRUE_FALSE.name, "Body systems work together instead of working alone.", choices("True", "False"), "True", "Body systems"),
        QuizQuestionEntity("sci_16", "sci_g5_q1_m4", QuestionType.MULTIPLE_CHOICE.name, "What is the role of producers in a food chain?", choices("Make their own food", "Eat only meat", "Break down waste", "Control weather"), "Make their own food", "Food chains"),
        QuizQuestionEntity("sci_17", "sci_g5_q1_m4", QuestionType.TRUE_FALSE.name, "Sunlight is an important energy source for many ecosystems.", choices("True", "False"), "True", "Energy flow"),
        QuizQuestionEntity("sci_18", "sci_g5_q1_m4", QuestionType.IDENTIFICATION.name, "What organisms break down dead plants and animals?", "", "decomposers", "Decomposers"),
        QuizQuestionEntity("sci_19", "sci_g5_q1_m4", QuestionType.MULTIPLE_CHOICE.name, "Which pair includes a living and a nonliving part of an ecosystem?", choices("Bird and grass", "Water and rock", "Frog and sunlight", "Mushroom and tree"), "Frog and sunlight", "Ecosystem parts"),
        QuizQuestionEntity("sci_20", "sci_g5_q1_m4", QuestionType.TRUE_FALSE.name, "A change in one part of an ecosystem can affect other parts.", choices("True", "False"), "True", "Ecosystem balance")
    )

    private fun mathQuestions() = listOf(
        QuizQuestionEntity("math_01", "math_g5_q1_m1", QuestionType.MULTIPLE_CHOICE.name, "What is 2/8 + 3/8?", choices("5/8", "5/16", "1/8", "6/8"), "5/8", "Adding like fractions"),
        QuizQuestionEntity("math_02", "math_g5_q1_m1", QuestionType.TRUE_FALSE.name, "When adding fractions with the same denominator, keep the denominator.", choices("True", "False"), "True", "Fraction vocabulary"),
        QuizQuestionEntity("math_03", "math_g5_q1_m1", QuestionType.IDENTIFICATION.name, "In 4/9, what is the number below the line called?", "", "denominator", "Fraction vocabulary"),
        QuizQuestionEntity("math_04", "math_g5_q1_m1", QuestionType.MULTIPLE_CHOICE.name, "What is 7/10 - 2/10?", choices("5/10", "9/10", "5/20", "1/10"), "5/10", "Subtracting like fractions"),
        QuizQuestionEntity("math_05", "math_g5_q1_m1", QuestionType.TRUE_FALSE.name, "A fraction model can help show why an answer is correct.", choices("True", "False"), "True", "Explaining with models"),
        QuizQuestionEntity("math_06", "math_g5_q1_m2", QuestionType.MULTIPLE_CHOICE.name, "What is 1/2 x 1/3?", choices("1/6", "2/5", "1/5", "2/6"), "1/6", "Multiplying fractions"),
        QuizQuestionEntity("math_07", "math_g5_q1_m2", QuestionType.TRUE_FALSE.name, "To multiply fractions, multiply the numerators and multiply the denominators.", choices("True", "False"), "True", "Multiplying fractions"),
        QuizQuestionEntity("math_08", "math_g5_q1_m2", QuestionType.IDENTIFICATION.name, "What is 2/3 x 3/4?", "", "6/12", "Fraction products"),
        QuizQuestionEntity("math_09", "math_g5_q1_m2", QuestionType.MULTIPLE_CHOICE.name, "Which expression means one half of eight?", choices("1/2 x 8", "8 + 1/2", "8 - 1/2", "8 / 2/1"), "1/2 x 8", "Fractions of whole numbers"),
        QuizQuestionEntity("math_10", "math_g5_q1_m2", QuestionType.TRUE_FALSE.name, "A visual model can show a part of a part.", choices("True", "False"), "True", "Explaining with models"),
        QuizQuestionEntity("math_11", "math_g5_q1_m3", QuestionType.MULTIPLE_CHOICE.name, "In 4.62, which digit is in the tenths place?", choices("4", "6", "2", "0"), "6", "Decimal place value"),
        QuizQuestionEntity("math_12", "math_g5_q1_m3", QuestionType.TRUE_FALSE.name, "0.5 is equal to 5/10.", choices("True", "False"), "True", "Decimals and fractions"),
        QuizQuestionEntity("math_13", "math_g5_q1_m3", QuestionType.IDENTIFICATION.name, "Write 35 hundredths as a decimal.", "", "0.35", "Decimal notation"),
        QuizQuestionEntity("math_14", "math_g5_q1_m3", QuestionType.MULTIPLE_CHOICE.name, "Which decimal is greatest?", choices("0.45", "0.5", "0.405", "0.049"), "0.5", "Comparing decimals"),
        QuizQuestionEntity("math_15", "math_g5_q1_m3", QuestionType.TRUE_FALSE.name, "Place value can help compare decimals.", choices("True", "False"), "True", "Comparing decimals"),
        QuizQuestionEntity("math_16", "math_g5_q1_m4", QuestionType.MULTIPLE_CHOICE.name, "What is the perimeter of a rectangle with sides 6 cm and 4 cm?", choices("10 cm", "20 cm", "24 cm", "12 cm"), "20 cm", "Perimeter"),
        QuizQuestionEntity("math_17", "math_g5_q1_m4", QuestionType.TRUE_FALSE.name, "Area is measured in square units.", choices("True", "False"), "True", "Area"),
        QuizQuestionEntity("math_18", "math_g5_q1_m4", QuestionType.IDENTIFICATION.name, "What is the area of a rectangle that is 5 m long and 3 m wide?", "", "15", "Area"),
        QuizQuestionEntity("math_19", "math_g5_q1_m4", QuestionType.MULTIPLE_CHOICE.name, "Which formula finds the area of a rectangle?", choices("length x width", "length + width", "side + side", "length - width"), "length x width", "Area formula"),
        QuizQuestionEntity("math_20", "math_g5_q1_m4", QuestionType.TRUE_FALSE.name, "Perimeter measures the distance around a shape.", choices("True", "False"), "True", "Perimeter")
    )

    private fun englishQuestions() = listOf(
        QuizQuestionEntity("eng_01", "eng_g5_q1_m1", QuestionType.MULTIPLE_CHOICE.name, "What does the main idea tell?", choices("The author's birthday", "What the text is mostly about", "Only the last sentence", "The longest word"), "What the text is mostly about", "Finding main idea"),
        QuizQuestionEntity("eng_02", "eng_g5_q1_m1", QuestionType.TRUE_FALSE.name, "Supporting details help explain the main idea.", choices("True", "False"), "True", "Finding supporting details"),
        QuizQuestionEntity("eng_03", "eng_g5_q1_m1", QuestionType.IDENTIFICATION.name, "What kind of detail gives a real situation or item to support an idea?", "", "example", "Using examples"),
        QuizQuestionEntity("eng_04", "eng_g5_q1_m1", QuestionType.MULTIPLE_CHOICE.name, "Which sentence is usually too broad to be a supporting detail?", choices("Plants need water.", "A mango seed can grow into a tree.", "Roots absorb water.", "Leaves use sunlight."), "Plants need water.", "Finding main idea"),
        QuizQuestionEntity("eng_05", "eng_g5_q1_m1", QuestionType.TRUE_FALSE.name, "Every supporting detail should connect to the main idea.", choices("True", "False"), "True", "Finding supporting details"),
        QuizQuestionEntity("eng_06", "eng_g5_q1_m2", QuestionType.MULTIPLE_CHOICE.name, "Which clue gives a word with a similar meaning?", choices("Synonym", "Antonym", "Prefix", "Period"), "Synonym", "Types of context clues"),
        QuizQuestionEntity("eng_07", "eng_g5_q1_m2", QuestionType.TRUE_FALSE.name, "An antonym clue can help by showing an opposite meaning.", choices("True", "False"), "True", "Types of context clues"),
        QuizQuestionEntity("eng_08", "eng_g5_q1_m2", QuestionType.IDENTIFICATION.name, "What do readers call words around an unfamiliar word that help explain it?", "", "context clues", "Using context"),
        QuizQuestionEntity("eng_09", "eng_g5_q1_m2", QuestionType.MULTIPLE_CHOICE.name, "In the sentence 'The trail was damp, or slightly wet,' what does damp mean?", choices("Dry", "Wet", "Wide", "Dusty"), "Wet", "Definition clues"),
        QuizQuestionEntity("eng_10", "eng_g5_q1_m2", QuestionType.TRUE_FALSE.name, "Readers should ignore nearby sentences when they meet a new word.", choices("True", "False"), "False", "Using context"),
        QuizQuestionEntity("eng_11", "eng_g5_q1_m3", QuestionType.MULTIPLE_CHOICE.name, "Which sentence is a fact?", choices("Mangoes are the best fruit.", "The story is boring.", "The school opens at 7:00.", "Blue is prettier than red."), "The school opens at 7:00.", "Facts"),
        QuizQuestionEntity("eng_12", "eng_g5_q1_m3", QuestionType.TRUE_FALSE.name, "An opinion can tell what someone believes or feels.", choices("True", "False"), "True", "Opinions"),
        QuizQuestionEntity("eng_13", "eng_g5_q1_m3", QuestionType.IDENTIFICATION.name, "What kind of statement can be checked or proven?", "", "fact", "Facts"),
        QuizQuestionEntity("eng_14", "eng_g5_q1_m3", QuestionType.MULTIPLE_CHOICE.name, "Which word often signals an opinion?", choices("Measured", "Proved", "Should", "Recorded"), "Should", "Opinion signals"),
        QuizQuestionEntity("eng_15", "eng_g5_q1_m3", QuestionType.TRUE_FALSE.name, "Evidence can help support a fact.", choices("True", "False"), "True", "Evidence"),
        QuizQuestionEntity("eng_16", "eng_g5_q1_m4", QuestionType.MULTIPLE_CHOICE.name, "Which text structure tells events in order?", choices("Sequence", "Problem and solution", "Description", "Compare and contrast"), "Sequence", "Text structures"),
        QuizQuestionEntity("eng_17", "eng_g5_q1_m4", QuestionType.TRUE_FALSE.name, "Cause and effect explains why something happened and what happened because of it.", choices("True", "False"), "True", "Cause and effect"),
        QuizQuestionEntity("eng_18", "eng_g5_q1_m4", QuestionType.IDENTIFICATION.name, "What text structure shows how two things are alike and different?", "", "compare and contrast", "Compare and contrast"),
        QuizQuestionEntity("eng_19", "eng_g5_q1_m4", QuestionType.MULTIPLE_CHOICE.name, "Which structure presents an issue and a way to fix it?", choices("Problem and solution", "Sequence", "Description", "Cause only"), "Problem and solution", "Problem and solution"),
        QuizQuestionEntity("eng_20", "eng_g5_q1_m4", QuestionType.TRUE_FALSE.name, "Recognizing text structure helps readers follow ideas.", choices("True", "False"), "True", "Text structures")
    )
}
