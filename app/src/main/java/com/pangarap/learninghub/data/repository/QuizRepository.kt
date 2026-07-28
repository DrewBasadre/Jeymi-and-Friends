package com.pangarap.learninghub.data.repository

import com.pangarap.learninghub.data.local.LearningHubDatabase
import com.pangarap.learninghub.data.local.ProgressEntity
import com.pangarap.learninghub.data.local.QuizAttemptEntity
import com.pangarap.learninghub.data.local.QuizQuestionEntity
import com.pangarap.learninghub.domain.LearningCalculations
import com.pangarap.learninghub.domain.MasteryLevel
import com.pangarap.learninghub.domain.ProgressStatus
import com.pangarap.learninghub.domain.QuizResult
import com.pangarap.learninghub.sync.QuizResultQr
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

class QuizRepository(private val db: LearningHubDatabase) {
    private val json = Json { prettyPrint = true }

    fun questionsForModule(moduleId: String): Flow<List<QuizQuestionEntity>> =
        db.quizQuestionDao().questionsForModule(moduleId)

    suspend fun submitQuiz(
        studentId: String,
        moduleId: String,
        answers: Map<String, String>,
        durationSeconds: Long
    ): QuizResult {
        val existingAttempts = db.quizAttemptDao().getAttemptsForModule(studentId, moduleId)
        if (existingAttempts.size >= 2) {
            return quizResultFromBestAttempt(studentId, moduleId, existingAttempts)
        }
        val questions = db.quizQuestionDao().getQuestionsForModule(moduleId)
        val normalizedAnswers = answers.mapValues { it.value.trim().lowercase() }
        val wrongQuestion = questions.firstOrNull {
            normalizedAnswers[it.id] != it.correctAnswer.trim().lowercase()
        }
        val score = questions.count {
            normalizedAnswers[it.id] == it.correctAnswer.trim().lowercase()
        }
        val weakTopic = wrongQuestion?.topicTag ?: "Ready for next challenge"
        val strongTopic = questions.firstOrNull {
            normalizedAnswers[it.id] == it.correctAnswer.trim().lowercase()
        }?.topicTag ?: "Needs more practice"
        val mastery = LearningCalculations.masteryFor(score, questions.size)
        val now = System.currentTimeMillis()
        val attemptId = "attempt_${UUID.randomUUID()}"
        val attemptNumber = existingAttempts.size + 1
        val student = db.studentDao().getStudent(studentId)
        val module = db.moduleDao().getModule(moduleId)
        val attempt = QuizAttemptEntity(
            id = attemptId,
            studentId = studentId,
            moduleId = moduleId,
            score = score,
            totalItems = questions.size,
            weakTopic = weakTopic,
            strongTopic = strongTopic,
            masteryLevel = mastery.name,
            durationSeconds = durationSeconds,
            attemptNumber = attemptNumber,
            submittedAt = now
        )
        db.quizAttemptDao().insert(attempt)
        val existingProgress = db.progressDao().getProgressForModule(studentId, moduleId)
        db.progressDao().upsert(
            ProgressEntity(
                id = "$studentId-$moduleId",
                studentId = studentId,
                moduleId = moduleId,
                status = existingProgress?.status?.takeIf { it == ProgressStatus.COMPLETED.name }
                    ?: ProgressStatus.IN_PROGRESS.name,
                masteryLevel = mastery.name,
                updatedAt = now
            )
        )
        return quizResultFromBestAttempt(studentId, moduleId, existingAttempts + attempt)
    }

    private suspend fun quizResultFromBestAttempt(
        studentId: String,
        moduleId: String,
        attempts: List<QuizAttemptEntity>
    ): QuizResult {
        val best = attempts.maxWith(
            compareBy<QuizAttemptEntity> { it.score.toDouble() / it.totalItems.coerceAtLeast(1) }
                .thenBy { it.submittedAt }
        )
        val student = db.studentDao().getStudent(studentId)
        val module = db.moduleDao().getModule(moduleId)
        val moduleTitle = module?.title ?: "Module"
        val studentNumber = student?.studentNumber?.ifBlank { student.id } ?: studentId
        val firstName = student?.firstName?.ifBlank { student.name.substringBefore(" ") }.orEmpty()
        val lastName = student?.lastName?.ifBlank { student.name.substringAfter(" ", "") }.orEmpty()
        val payload = QuizResultQr(
            attemptId = best.id,
            studentId = studentId,
            studentNumber = studentNumber,
            firstName = firstName,
            lastName = lastName,
            middleInitial = student?.middleInitial.orEmpty(),
            displayName = student?.name ?: studentId,
            gradeLevel = student?.gradeLevel ?: module?.gradeLevel ?: 5,
            section = student?.section.orEmpty(),
            moduleId = moduleId,
            moduleTitle = moduleTitle,
            subject = module?.subject.orEmpty(),
            competencyCode = module?.competencyCode.orEmpty(),
            score = best.score,
            totalItems = best.totalItems,
            weakTopic = best.weakTopic,
            strongTopic = best.strongTopic,
            masteryLevel = best.masteryLevel,
            durationSeconds = best.durationSeconds,
            attemptNumber = best.attemptNumber,
            submittedAt = best.submittedAt
        )
        return QuizResult(
            attemptId = best.id,
            moduleId = moduleId,
            moduleTitle = moduleTitle,
            score = best.score,
            totalItems = best.totalItems,
            weakTopic = best.weakTopic,
            strongTopic = best.strongTopic,
            masteryLevel = MasteryLevel.valueOf(best.masteryLevel),
            attemptNumber = best.attemptNumber,
            durationSeconds = best.durationSeconds,
            resultJson = json.encodeToString(payload)
        )
    }
}
