package com.pangarap.learninghub.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface StudentDao {
    @Query("SELECT * FROM students WHERE isArchived = 0 ORDER BY name")
    fun activeStudents(): Flow<List<StudentEntity>>

    @Query("SELECT * FROM students ORDER BY isArchived, name")
    fun allStudents(): Flow<List<StudentEntity>>

    @Query("SELECT * FROM students WHERE id = :id")
    fun observeStudent(id: String): Flow<StudentEntity?>

    @Query("SELECT * FROM students WHERE id = :id")
    suspend fun getStudent(id: String): StudentEntity?

    @Query(
        """
        SELECT * FROM students
        WHERE isArchived = 0
        AND (
            lower(studentNumber) = lower(:identifier)
            OR lower(id) = lower(:identifier)
            OR lower(lastName) = lower(:identifier)
            OR lower(name) = lower(:identifier)
        )
        LIMIT 1
        """
    )
    suspend fun findForLogin(identifier: String): StudentEntity?

    @Query(
        """
        SELECT * FROM students
        WHERE (
            trim(:studentId) != ''
            AND lower(trim(id)) = lower(trim(:studentId))
        )
        OR (
            trim(:studentNumber) != ''
            AND lower(trim(studentNumber)) = lower(trim(:studentNumber))
        )
        OR (
            trim(:displayName) != ''
            AND (
                lower(trim(name)) = lower(trim(:displayName))
                OR lower(trim(firstName || ' ' || lastName)) = lower(trim(:displayName))
                OR lower(trim(lastName || ', ' || firstName)) = lower(trim(:displayName))
            )
        )
        OR (
            trim(:firstName) != ''
            AND trim(:lastName) != ''
            AND lower(trim(firstName)) = lower(trim(:firstName))
            AND lower(trim(lastName)) = lower(trim(:lastName))
        )
        ORDER BY CASE
            WHEN trim(:studentId) != '' AND lower(trim(id)) = lower(trim(:studentId)) THEN 0
            WHEN trim(:studentNumber) != '' AND lower(trim(studentNumber)) = lower(trim(:studentNumber)) THEN 1
            WHEN trim(:firstName) != '' AND trim(:lastName) != '' AND lower(trim(firstName)) = lower(trim(:firstName)) AND lower(trim(lastName)) = lower(trim(:lastName)) THEN 2
            ELSE 3
        END
        LIMIT 1
        """
    )
    suspend fun findByQrIdentity(
        studentId: String,
        studentNumber: String,
        firstName: String,
        lastName: String,
        displayName: String
    ): StudentEntity?

    @Query("SELECT COUNT(*) FROM students")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(student: StudentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(students: List<StudentEntity>)
}

@Dao
interface ModuleDao {
    @Query("SELECT * FROM modules WHERE gradeLevel = :gradeLevel ORDER BY subject, quarter, title")
    fun modulesForGrade(gradeLevel: Int): Flow<List<ModuleEntity>>

    @Query("SELECT * FROM modules WHERE id = :id")
    fun observeModule(id: String): Flow<ModuleEntity?>

    @Query("SELECT * FROM modules WHERE id = :id")
    suspend fun getModule(id: String): ModuleEntity?

    @Query("SELECT COUNT(*) FROM modules WHERE gradeLevel = :gradeLevel")
    suspend fun countForGrade(gradeLevel: Int): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(module: ModuleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(modules: List<ModuleEntity>)
}

@Dao
interface QuizQuestionDao {
    @Query("SELECT * FROM quiz_questions WHERE moduleId = :moduleId ORDER BY id")
    fun questionsForModule(moduleId: String): Flow<List<QuizQuestionEntity>>

    @Query("SELECT * FROM quiz_questions WHERE moduleId = :moduleId ORDER BY id")
    suspend fun getQuestionsForModule(moduleId: String): List<QuizQuestionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(questions: List<QuizQuestionEntity>)
}

@Dao
interface QuizAttemptDao {
    @Query("SELECT * FROM quiz_attempts WHERE studentId = :studentId ORDER BY submittedAt DESC")
    fun attemptsForStudent(studentId: String): Flow<List<QuizAttemptEntity>>

    @Query("SELECT * FROM quiz_attempts ORDER BY submittedAt DESC")
    fun allAttempts(): Flow<List<QuizAttemptEntity>>

    @Query("SELECT * FROM quiz_attempts WHERE studentId = :studentId ORDER BY submittedAt DESC")
    suspend fun getAttemptsForStudent(studentId: String): List<QuizAttemptEntity>

    @Query("SELECT * FROM quiz_attempts WHERE studentId = :studentId AND moduleId = :moduleId ORDER BY submittedAt DESC")
    fun attemptsForModule(studentId: String, moduleId: String): Flow<List<QuizAttemptEntity>>

    @Query("SELECT * FROM quiz_attempts WHERE studentId = :studentId AND moduleId = :moduleId ORDER BY submittedAt DESC")
    suspend fun getAttemptsForModule(studentId: String, moduleId: String): List<QuizAttemptEntity>

    @Query("SELECT COUNT(*) FROM quiz_attempts WHERE studentId = :studentId AND moduleId = :moduleId")
    suspend fun countAttemptsForModule(studentId: String, moduleId: String): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(attempt: QuizAttemptEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(attempts: List<QuizAttemptEntity>)
}

@Dao
interface ProgressDao {
    @Query("SELECT * FROM progress WHERE studentId = :studentId")
    fun progressForStudent(studentId: String): Flow<List<ProgressEntity>>

    @Query("SELECT * FROM progress")
    fun allProgress(): Flow<List<ProgressEntity>>

    @Query("SELECT * FROM progress WHERE studentId = :studentId")
    suspend fun getProgressForStudent(studentId: String): List<ProgressEntity>

    @Query("SELECT * FROM progress WHERE studentId = :studentId AND moduleId = :moduleId LIMIT 1")
    suspend fun getProgressForModule(studentId: String, moduleId: String): ProgressEntity?

    @Query("SELECT * FROM progress WHERE studentId = :studentId AND moduleId = :moduleId LIMIT 1")
    fun progressForModule(studentId: String, moduleId: String): Flow<ProgressEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(progress: ProgressEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(progress: List<ProgressEntity>)
}

@Dao
interface LessonPlanDao {
    @Query("SELECT * FROM lesson_plans ORDER BY createdAt DESC")
    fun lessonPlans(): Flow<List<LessonPlanEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(plan: LessonPlanEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(plans: List<LessonPlanEntity>)
}

@Dao
interface TeacherMaterialDao {
    @Query("SELECT * FROM teacher_materials ORDER BY subject, title")
    fun materials(): Flow<List<TeacherMaterialEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(materials: List<TeacherMaterialEntity>)
}
