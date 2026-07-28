package com.pangarap.learninghub.data.repository

import com.pangarap.learninghub.data.local.LearningHubDatabase
import com.pangarap.learninghub.data.local.ProgressEntity
import com.pangarap.learninghub.data.local.QuizAttemptEntity
import com.pangarap.learninghub.data.local.StudentEntity
import com.pangarap.learninghub.domain.LearningCalculations
import com.pangarap.learninghub.domain.MasteryLevel
import com.pangarap.learninghub.domain.ProgressStatus
import com.pangarap.learninghub.domain.StudentDashboardSummary
import com.pangarap.learninghub.domain.SubjectType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

class StudentRepository(private val db: LearningHubDatabase) {
    fun activeStudents(): Flow<List<StudentEntity>> = db.studentDao().activeStudents()

    fun observeStudent(id: String): Flow<StudentEntity?> = db.studentDao().observeStudent(id)

    fun progressForStudent(studentId: String) = db.progressDao().progressForStudent(studentId)

    fun attemptsForModule(studentId: String, moduleId: String) =
        db.quizAttemptDao().attemptsForModule(studentId, moduleId)

    suspend fun login(identifier: String, pin: String): StudentEntity? {
        val student = db.studentDao().findForLogin(identifier.trim()) ?: return null
        return if (student.pin == pin.trim()) student else null
    }

    suspend fun saveStudent(
        studentId: String?,
        studentNumber: String,
        firstName: String,
        lastName: String,
        middleInitial: String,
        gradeLevel: Int,
        section: String,
        birthday: String,
        pin: String,
        profileImageUri: String = ""
    ): StudentEntity {
        val cleanStudentNumber = studentNumber.trim()
        val id = studentId?.takeIf { it.isNotBlank() }
            ?: "student_${cleanStudentNumber.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_').ifBlank { System.currentTimeMillis().toString() }}"
        val displayName = listOf(firstName.trim(), lastName.trim()).filter { it.isNotBlank() }.joinToString(" ")
        val existing = db.studentDao().getStudent(id)
        val student = StudentEntity(
            id = id,
            studentNumber = cleanStudentNumber,
            firstName = firstName.trim(),
            lastName = lastName.trim(),
            middleInitial = middleInitial.trim().take(1),
            name = displayName.ifBlank { cleanStudentNumber },
            gradeLevel = gradeLevel,
            section = section.trim(),
            birthday = birthday.trim(),
            profileImageUri = profileImageUri.ifBlank { existing?.profileImageUri.orEmpty() },
            pin = pin.trim(),
            avatarColor = existing?.avatarColor ?: 0xFF2563EBL,
            isArchived = existing?.isArchived ?: false
        )
        db.studentDao().insert(student)
        return student
    }

    suspend fun updateProfileImage(studentId: String, profileImageUri: String) {
        val student = db.studentDao().getStudent(studentId) ?: return
        db.studentDao().insert(student.copy(profileImageUri = profileImageUri))
    }

    fun hasCompletedAssessment(studentId: String, moduleId: String): Flow<Boolean> =
        db.progressDao().progressForModule(studentId, moduleId).map { progress ->
            progress?.status == ProgressStatus.COMPLETED.name
        }

    suspend fun markLessonRead(studentId: String, moduleId: String) {
        val existing = db.progressDao().getProgressForModule(studentId, moduleId)
        if (existing?.status == ProgressStatus.COMPLETED.name) return
        db.progressDao().upsert(
            ProgressEntity(
                id = "$studentId-$moduleId",
                studentId = studentId,
                moduleId = moduleId,
                status = ProgressStatus.IN_PROGRESS.name,
                masteryLevel = existing?.masteryLevel ?: MasteryLevel.BEGINNER.name,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun markModuleDone(studentId: String, moduleId: String) {
        val attempts = db.quizAttemptDao().getAttemptsForModule(studentId, moduleId)
        if (attempts.isEmpty()) return
        val bestAttempt = attempts.maxWith(
            compareBy<QuizAttemptEntity> { it.score.toDouble() / it.totalItems.coerceAtLeast(1) }
                .thenBy { it.submittedAt }
        )
        db.progressDao().upsert(
            ProgressEntity(
                id = "$studentId-$moduleId",
                studentId = studentId,
                moduleId = moduleId,
                status = ProgressStatus.COMPLETED.name,
                masteryLevel = bestAttempt.masteryLevel,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    fun dashboardSummary(studentId: String): Flow<StudentDashboardSummary?> {
        val studentFlow = db.studentDao().observeStudent(studentId)
        val attemptsFlow = db.quizAttemptDao().attemptsForStudent(studentId)
        val progressFlow = db.progressDao().progressForStudent(studentId)
        val modulesFlow = db.moduleDao().modulesForGrade(5)
        return combine(studentFlow, attemptsFlow, progressFlow, modulesFlow) { student, attempts, progress, modules ->
            if (student == null) return@combine null
            val coreModules = modules.filterNot { it.subject == SubjectType.ADDED_MATERIALS.name }
            val coreModuleIds = coreModules.map { it.id }.toSet()
            val completed = progress.count { it.moduleId in coreModuleIds && it.status == "COMPLETED" }
            val average = LearningCalculations.averagePercent(attempts.map { it.score to it.totalItems })
            val latestAttempt = attempts.maxByOrNull { it.submittedAt }
            val weakTopic = attempts.firstOrNull { it.weakTopic != "Ready for next challenge" }?.weakTopic
                ?: "No weak topic yet"
            val strongTopic = attempts.maxByOrNull { it.score.toDouble() / it.totalItems.coerceAtLeast(1) }
                ?.let { attempt -> modules.firstOrNull { it.id == attempt.moduleId }?.subject }
                ?: "Take a quiz to unlock"
            StudentDashboardSummary(
                studentId = student.id,
                studentNumber = student.studentNumber,
                firstName = student.firstName,
                lastName = student.lastName,
                name = student.name,
                gradeLevel = student.gradeLevel,
                section = student.section,
                completedModules = completed,
                totalModules = coreModules.size,
                averageScore = average,
                weakTopic = weakTopic,
                strongTopic = strongTopic,
                gradeCompletionPercent = LearningCalculations.completionPercent(completed, coreModules.size),
                totalAttempts = attempts.size,
                lastQuizDurationSeconds = latestAttempt?.durationSeconds ?: 0
            )
        }
    }
}
