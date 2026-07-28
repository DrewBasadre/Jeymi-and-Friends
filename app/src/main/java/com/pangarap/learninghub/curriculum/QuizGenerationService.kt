package com.pangarap.learninghub.curriculum

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

/*
 * Integration Notes
 * -----------------
 * QuizGenerationService is intentionally separate from LessonPlanService. The
 * app layer links a QuizResponse to its parent lesson by lesson title and
 * subject after it has set lessonPlan.quizUnlocked to true.
 *
 * Required configuration:
 * - GEMINI_API_KEY through BuildConfig.
 * - A CurriculumStore already configured for the same authoritative curriculum.
 */
class QuizGenerationService(
    private val geminiClient: GeminiRestClient = GeminiRestClient(),
    private val changelogManager: ChangelogManager = ChangelogManager(),
    private val config: QuizGenerationServiceConfig = QuizGenerationServiceConfig(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    suspend fun generateQuiz(
        lessonPlan: LessonPlanResponse,
        curriculumStore: CurriculumStore,
        questionCount: Int = 7,
        questionTypes: List<String> = listOf("multiple_choice", "short_answer")
    ): QuizGenerationResult {
        if (!lessonPlan.quizUnlocked) {
            return ServiceError(
                error = "QUIZ_LOCKED",
                message = "Quiz generation is not available until the learner has completed the primary lesson content."
            )
        }
        if (questionCount !in 5..10) {
            return serviceError("VALIDATION_ERROR", "question_count must be between 5 and 10.")
        }
        val normalizedTypes = questionTypes.map { it.trim().lowercase() }.filter { it.isNotBlank() }.distinct()
        if (normalizedTypes.isEmpty() || normalizedTypes.any { it !in SUPPORTED_QUESTION_TYPES }) {
            return serviceError("VALIDATION_ERROR", "question_types must contain only multiple_choice and short_answer.")
        }

        return runCatching {
            val compositeObjectiveQuery = buildCompositeObjectiveQuery(lessonPlan)
            val retrieved = curriculumStore.retrieve(query = compositeObjectiveQuery, topK = questionCount)
            if (retrieved.isEmpty()) {
                serviceError("NO_CURRICULUM_MATCH", "The lesson objectives could not be mapped back to indexed curriculum chunks.")
            } else {
                val prompt = buildQuizPrompt(
                    lessonPlan = lessonPlan,
                    chunks = retrieved,
                    questionCount = questionCount,
                    questionTypes = normalizedTypes
                )
                val generated = geminiClient.generateContent(
                    model = config.model,
                    userPrompt = prompt,
                    systemInstruction = null,
                    generationConfig = GeminiGenerationConfig(
                        temperature = config.temperature,
                        topP = config.topP,
                        maxOutputTokens = config.maxOutputTokens,
                        responseMimeType = "application/json",
                        maxRetries = config.maxRetries
                    )
                )
                parseValidateAndMaybeCorrect(
                    raw = generated,
                    originalPrompt = prompt,
                    citations = retrieved.map { it.sourceReference() }.distinct(),
                    minimumQuestions = 5
                ).also { result ->
                    if (result is QuizResponse) {
                        changelogManager.logQuizGenerated(
                            lessonTitle = result.lessonTitle,
                            subject = result.subject,
                            gradeLevel = result.gradeLevel,
                            questionCount = result.totalQuestions,
                            typeDistribution = result.questions.groupingBy { it.questionType }.eachCount(),
                            competencyCodes = result.questions.map { it.curriculumReference }
                        )
                    }
                }
            }
        }.getOrElse { failure ->
            changelogManager.logError(
                componentName = "QuizGenerationService",
                errorCodeOrType = failure::class.simpleName.orEmpty(),
                description = failure.message.orEmpty().ifBlank { "Quiz generation failed" }
            )
            ServiceError("GENERATION_ERROR", "Quiz generation failed: ${failure.safeMessage()}")
        }
    }

    suspend fun generate_quiz(
        lesson_plan: LessonPlanResponse,
        curriculum_store: CurriculumStore,
        question_count: Int = 7,
        question_types: List<String> = listOf("multiple_choice", "short_answer")
    ): QuizGenerationResult =
        generateQuiz(
            lessonPlan = lesson_plan,
            curriculumStore = curriculum_store,
            questionCount = question_count,
            questionTypes = question_types
        )

    private fun buildCompositeObjectiveQuery(lessonPlan: LessonPlanResponse): String {
        val objectives = lessonPlan.learningObjectives.joinToString(separator = "\n") {
            "- ${it.objective} ${it.curriculumReference}"
        }
        return """
            Subject: ${lessonPlan.subject}
            Grade Level: ${lessonPlan.gradeLevel}
            Learning Objectives:
            $objectives
        """.trimIndent()
    }

    private fun buildQuizPrompt(
        lessonPlan: LessonPlanResponse,
        chunks: List<CurriculumChunk>,
        questionCount: Int,
        questionTypes: List<String>
    ): String {
        val context = CurriculumContextFormatter.format(
            chunks = chunks,
            maxApproxTokens = config.contextTokenLimit
        )
        val schema = """
            {
              "lesson_title": "string",
              "grade_level": "string",
              "subject": "string",
              "questions": [
                {
                  "question_id": "Q1",
                  "question_type": "multiple_choice | short_answer",
                  "question_text": "string",
                  "choices": ["string"],
                  "correct_answer": "string",
                  "curriculum_reference": "string",
                  "explanation": "string"
                }
              ],
              "total_questions": integer,
              "curriculum_citations": ["string"]
            }
        """.trimIndent()
        return """
            SYSTEM:
            You are an expert DepEd curriculum assessment designer. Generate assessment questions exclusively
            from the curriculum content provided. Do not introduce concepts, facts, or standards not present
            in the curriculum context below.

            CURRICULUM CONTEXT (Source of Truth):
            ---
            $context
            ---

            LESSON PARAMETERS:
            - Subject: ${lessonPlan.subject}
            - Grade Level: ${lessonPlan.gradeLevel}
            - Lesson Title: ${lessonPlan.lessonTitle}
            - Question Count: $questionCount (minimum 5, maximum 10)
            - Question Types Requested: ${questionTypes.joinToString()}

            CONSTRAINTS:
            1. Every question must be directly derivable from a specific competency or learning objective in the curriculum context above.
            2. Every question must include a curriculum_reference citing the exact competency code or unit title it tests.
            3. Multiple choice questions must have exactly 4 answer choices, with one unambiguously correct answer.
            4. Short answer questions must have a model answer grounded in the curriculum context.
            5. Do not repeat the same competency across more than 2 questions.
            6. Distribute question types proportionally across the requested types.

            OUTPUT FORMAT (valid JSON only, no markdown):
            $schema
        """.trimIndent()
    }

    private suspend fun parseValidateAndMaybeCorrect(
        raw: String,
        originalPrompt: String,
        citations: List<String>,
        minimumQuestions: Int
    ): QuizGenerationResult {
        val first = parseAndValidateQuiz(raw, citations)
        if (first is QuizResponse && first.totalQuestions >= minimumQuestions) return first
        val reason = if (first is ServiceError) first.message else "Fewer than $minimumQuestions valid questions remained after validation."
        val correctionPrompt = """
            $originalPrompt

            The previous quiz response was invalid: $reason
            Return corrected valid JSON only. Ensure at least $minimumQuestions valid questions remain after validation.
        """.trimIndent()
        val corrected = geminiClient.generateContent(
            model = config.model,
            userPrompt = correctionPrompt,
            systemInstruction = null,
            generationConfig = GeminiGenerationConfig(
                temperature = config.temperature,
                topP = config.topP,
                maxOutputTokens = config.maxOutputTokens,
                responseMimeType = "application/json",
                maxRetries = config.maxRetries
            )
        )
        return parseAndValidateQuiz(corrected, citations).let { result ->
            if (result is QuizResponse && result.totalQuestions >= minimumQuestions) {
                result
            } else {
                serviceError("INVALID_GEMINI_RESPONSE", "Gemini did not return at least $minimumQuestions valid quiz questions after one correction attempt.")
            }
        }
    }

    private fun parseAndValidateQuiz(raw: String, citations: List<String>): QuizGenerationResult {
        return try {
            val parsed = json.decodeFromString<QuizResponse>(raw.extractJsonObject())
            val filtered = enforceQuestionValidation(parsed.questions)
            val normalized = parsed.copy(
                questions = filtered.mapIndexed { index, question -> question.copy(questionId = "Q${index + 1}") },
                totalQuestions = filtered.size,
                curriculumCitations = citations
            )
            val validationError = normalized.validationError()
            if (validationError == null) normalized else serviceError("INVALID_GEMINI_RESPONSE", validationError)
        } catch (failure: SerializationException) {
            serviceError("INVALID_GEMINI_RESPONSE", failure.message.orEmpty().ifBlank { "Response was not valid JSON" })
        } catch (failure: IllegalArgumentException) {
            serviceError("INVALID_GEMINI_RESPONSE", failure.message.orEmpty().ifBlank { "Response was not a JSON object" })
        }
    }

    private fun enforceQuestionValidation(questions: List<QuizQuestion>): List<QuizQuestion> {
        val competencyCounts = mutableMapOf<String, Int>()
        return questions.mapNotNull { question ->
            val reference = question.curriculumReference.trim()
            if (reference.isBlank()) return@mapNotNull null
            val currentCount = competencyCounts.getOrDefault(reference, 0)
            if (currentCount >= 2) return@mapNotNull null
            val questionType = question.questionType.trim().lowercase()
            val questionText = question.questionText.trim()
            val correctAnswer = question.correctAnswer.trim()
            val explanation = question.explanation.trim()
            if (questionText.isBlank() || explanation.isBlank()) return@mapNotNull null
            val normalized = when (questionType) {
                "multiple_choice" -> {
                    val choices = question.choices.map { it.trim() }.filter { it.isNotBlank() }
                    if (choices.size != 4 || choices.distinct().size != 4 || correctAnswer !in choices) return@mapNotNull null
                    question.copy(
                        questionType = questionType,
                        questionText = questionText,
                        choices = choices,
                        correctAnswer = correctAnswer,
                        curriculumReference = reference,
                        explanation = explanation
                    )
                }
                "short_answer" -> {
                    if (correctAnswer.isBlank()) return@mapNotNull null
                    question.copy(
                        questionType = questionType,
                        questionText = questionText,
                        choices = emptyList(),
                        correctAnswer = correctAnswer,
                        curriculumReference = reference,
                        explanation = explanation
                    )
                }
                else -> return@mapNotNull null
            }
            competencyCounts[reference] = currentCount + 1
            normalized
        }
    }

    private fun serviceError(error: String, message: String): ServiceError {
        changelogManager.logError(
            componentName = "QuizGenerationService",
            errorCodeOrType = error,
            description = message
        )
        return ServiceError(error, message)
    }

    companion object {
        val SUPPORTED_QUESTION_TYPES = setOf("multiple_choice", "short_answer")
    }
}

data class QuizGenerationServiceConfig(
    val model: String = "gemini-1.5-pro",
    val contextTokenLimit: Int = 6_000,
    val temperature: Double = 0.2,
    val topP: Double = 0.85,
    val maxOutputTokens: Int = 4_096,
    val maxRetries: Int = 3
)

sealed interface QuizGenerationResult

@Serializable
data class QuizResponse(
    @SerialName("lesson_title") val lessonTitle: String,
    @SerialName("grade_level") val gradeLevel: String,
    val subject: String,
    val questions: List<QuizQuestion>,
    @SerialName("total_questions") val totalQuestions: Int,
    @SerialName("curriculum_citations") val curriculumCitations: List<String>
) : QuizGenerationResult

@Serializable
data class QuizQuestion(
    @SerialName("question_id") val questionId: String,
    @SerialName("question_type") val questionType: String,
    @SerialName("question_text") val questionText: String,
    val choices: List<String>,
    @SerialName("correct_answer") val correctAnswer: String,
    @SerialName("curriculum_reference") val curriculumReference: String,
    val explanation: String
)

private fun QuizResponse.validationError(): String? {
    return when {
        lessonTitle.isBlank() -> "lesson_title is required"
        gradeLevel.isBlank() -> "grade_level is required"
        subject.isBlank() -> "subject is required"
        questions.isEmpty() -> "questions must not be empty"
        totalQuestions != questions.size -> "total_questions must match questions array length"
        curriculumCitations.isEmpty() -> "curriculum_citations must not be empty"
        questions.any { it.curriculumReference.isBlank() || it.questionText.isBlank() || it.explanation.isBlank() } ->
            "each question must include question_text, curriculum_reference, and explanation"
        questions.any { !it.explanation.contains("[SRC:") } ->
            "each question explanation must cite the curriculum using [SRC: ...] notation"
        else -> null
    }
}

private fun Throwable.safeMessage(): String =
    message.orEmpty().ifBlank { this::class.simpleName.orEmpty() }.take(300)
