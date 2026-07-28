package com.pangarap.learninghub.data.repository

import com.pangarap.learninghub.data.local.LearningHubDatabase
import com.pangarap.learninghub.data.local.LessonPlanEntity
import com.pangarap.learninghub.data.local.QuizAttemptEntity
import com.pangarap.learninghub.domain.LearningCalculations
import com.pangarap.learninghub.domain.RecordBookRow
import com.pangarap.learninghub.domain.SubjectType
import com.pangarap.learninghub.domain.TeacherDashboardSummary
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

class TeacherRepository(private val db: LearningHubDatabase) {
    fun recordBook(): Flow<List<RecordBookRow>> {
        return combine(
            db.studentDao().allStudents(),
            db.quizAttemptDao().allAttempts(),
            db.progressDao().allProgress(),
            db.moduleDao().modulesForGrade(5)
        ) { students, attempts, progress, modules ->
            val coreModules = modules.filterNot { it.subject == SubjectType.ADDED_MATERIALS.name }
            val coreModuleIds = coreModules.map { it.id }.toSet()
            students.map { student ->
                val studentAttempts = attempts.filter { it.studentId == student.id }
                val studentProgress = progress.filter { it.studentId == student.id }
                val average = LearningCalculations.averagePercent(studentAttempts.map { it.score to it.totalItems })
                val completed = studentProgress.count { it.moduleId in coreModuleIds && it.status == "COMPLETED" }
                val latestAttempt = studentAttempts.maxByOrNull { it.submittedAt }
                RecordBookRow(
                    studentId = student.id,
                    studentNumber = student.studentNumber,
                    firstName = student.firstName,
                    lastName = student.lastName,
                    middleInitial = student.middleInitial,
                    name = student.name,
                    gradeLevel = student.gradeLevel,
                    section = student.section,
                    averageScore = average,
                    completedModules = completed,
                    totalModules = coreModules.size,
                    weakTopic = studentAttempts.firstOrNull { it.weakTopic != "Ready for next challenge" }?.weakTopic
                        ?: "No weak topic yet",
                    gradeCompletionPercent = LearningCalculations.completionPercent(completed, coreModules.size),
                    isArchived = student.isArchived,
                    totalAttempts = studentAttempts.size,
                    lastQuizDurationSeconds = latestAttempt?.durationSeconds ?: 0
                )
            }.sortedByDescending { it.averageScore }
        }
    }

    fun dashboard(): Flow<TeacherDashboardSummary> {
        return recordBook().combine(db.quizAttemptDao().allAttempts()) { rows, _ ->
            val active = rows.filterNot { it.isArchived }
            val classAverage = if (active.isEmpty()) 0.0 else active.map { it.averageScore }.average()
            TeacherDashboardSummary(
                classAverage = (classAverage * 10).toInt() / 10.0,
                topStudents = active.sortedByDescending { it.averageScore }.take(3),
                lowestStudents = active.sortedBy { it.averageScore }.take(3),
                interventionStudents = active.filter { it.averageScore < 75.0 || it.weakTopic != "No weak topic yet" }
                    .sortedBy { it.averageScore }
                    .take(5)
            )
        }
    }

    fun recordForStudent(studentId: String): Flow<RecordBookRow?> =
        recordBook().map { rows -> rows.firstOrNull { it.studentId == studentId } }

    fun attemptsForStudent(studentId: String): Flow<List<QuizAttemptEntity>> =
        db.quizAttemptDao().attemptsForStudent(studentId)

    fun lessonPlans(): Flow<List<LessonPlanEntity>> = db.lessonPlanDao().lessonPlans()

    suspend fun saveLessonPlan(plan: LessonPlanEntity) {
        db.lessonPlanDao().insert(plan)
    }
}
