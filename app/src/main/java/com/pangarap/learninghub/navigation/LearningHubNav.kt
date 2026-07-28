package com.pangarap.learninghub.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.pangarap.learninghub.ui.LearningHubViewModel
import com.pangarap.learninghub.ui.screens.DigitalLessonScreen
import com.pangarap.learninghub.ui.screens.GurobotScreen
import com.pangarap.learninghub.ui.screens.LessonPlanLibraryScreen
import com.pangarap.learninghub.ui.screens.LessonPreviewScreen
import com.pangarap.learninghub.ui.screens.LessonScreen
import com.pangarap.learninghub.ui.screens.ModuleLibraryScreen
import com.pangarap.learninghub.ui.screens.QuizResultScreen
import com.pangarap.learninghub.ui.screens.QuizScreen
import com.pangarap.learninghub.ui.screens.RecordBookScreen
import com.pangarap.learninghub.ui.screens.RoleSelectionScreen
import com.pangarap.learninghub.ui.screens.StudentDashboardScreen
import com.pangarap.learninghub.ui.screens.StudentInfoQrScreen
import com.pangarap.learninghub.ui.screens.StudentLoginScreen
import com.pangarap.learninghub.ui.screens.StudentModuleScannerScreen
import com.pangarap.learninghub.ui.screens.StudentPerformanceScreen
import com.pangarap.learninghub.ui.screens.StudentProfileScreen
import com.pangarap.learninghub.ui.screens.StudentQrCodeScreen
import com.pangarap.learninghub.ui.screens.SyncScreen
import com.pangarap.learninghub.ui.screens.TeacherDashboardScreen
import com.pangarap.learninghub.ui.screens.TeacherLoginScreen
import com.pangarap.learninghub.ui.screens.TeacherScannerScreen
import com.pangarap.learninghub.ui.screens.TeacherStudentViewScreen

@Composable
fun LearningHubNav(viewModel: LearningHubViewModel) {
    val nav = rememberNavController()
    val teacherRecordBook = { nav.navigate("recordBook") }
    val teacherScanner = { nav.navigate("teacherScanner") }
    val teacherGurobot = { nav.navigate("gurobot") }
    val teacherStudentView = { nav.navigate("teacherStudentView") }

    NavHost(navController = nav, startDestination = "role") {
        composable("role") {
            RoleSelectionScreen(
                onStudent = { nav.navigate("studentLogin") },
                onTeacher = { nav.navigate("teacherLogin") }
            )
        }
        composable("studentLogin") {
            StudentLoginScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onOpenStudent = { nav.navigate("student/$it") },
                onCreateInfoQr = { nav.navigate("studentInfoQr/new") }
            )
        }
        composable(
            route = "student/{studentId}",
            arguments = listOf(navArgument("studentId") { type = NavType.StringType })
        ) {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            StudentDashboardScreen(
                viewModel = viewModel,
                studentId = studentId,
                onBack = { nav.navigate("role") { popUpTo("role") { inclusive = true } } },
                onModules = { nav.navigate("modules/$studentId") },
                onQrCode = { nav.navigate("studentQr/$studentId") },
                onProfile = { nav.navigate("studentProfile/$studentId") }
            )
        }
        composable("studentInfoQr/{studentId}", listOf(navArgument("studentId") { type = NavType.StringType })) {
            StudentInfoQrScreen(
                viewModel = viewModel,
                studentId = it.arguments?.getString("studentId").orEmpty(),
                onBack = { nav.popBackStack() }
            )
        }
        composable("studentScanner/{studentId}", listOf(navArgument("studentId") { type = NavType.StringType })) {
            StudentModuleScannerScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() }
            )
        }
        composable("modules/{studentId}", listOf(navArgument("studentId") { type = NavType.StringType })) {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            ModuleLibraryScreen(
                viewModel = viewModel,
                studentId = studentId,
                onBack = { nav.popBackStack() },
                onStartLesson = { moduleId -> nav.navigate("digitalLesson/$studentId/$moduleId") },
                onTakeQuiz = { moduleId -> nav.navigate("quiz/$studentId/$moduleId") }
            )
        }
        composable("studentQr/{studentId}", listOf(navArgument("studentId") { type = NavType.StringType })) {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            StudentQrCodeScreen(
                viewModel = viewModel,
                studentId = studentId,
                onBack = { nav.popBackStack() },
                onModules = { nav.navigate("modules/$studentId") },
                onQrCode = { nav.navigate("studentQr/$studentId") },
                onProfile = { nav.navigate("studentProfile/$studentId") }
            )
        }
        composable("studentProfile/{studentId}", listOf(navArgument("studentId") { type = NavType.StringType })) {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            StudentProfileScreen(
                viewModel = viewModel,
                studentId = studentId,
                onBack = { nav.popBackStack() },
                onModules = { nav.navigate("modules/$studentId") },
                onQrCode = { nav.navigate("studentQr/$studentId") },
                onProfile = { nav.navigate("studentProfile/$studentId") }
            )
        }
        composable("digitalLesson/{studentId}/{moduleId}") {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            val moduleId = it.arguments?.getString("moduleId").orEmpty()
            DigitalLessonScreen(
                viewModel = viewModel,
                studentId = studentId,
                moduleId = moduleId,
                onBackToModules = { nav.navigate("modules/$studentId") { popUpTo("modules/$studentId") { inclusive = true } } }
            )
        }
        composable("lesson/{studentId}/{moduleId}") {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            val moduleId = it.arguments?.getString("moduleId").orEmpty()
            LessonScreen(
                viewModel = viewModel,
                studentId = studentId,
                moduleId = moduleId,
                onBack = { nav.popBackStack() },
                onStartQuiz = { nav.navigate("quiz/$studentId/$moduleId") },
                onMarkedDone = { nav.navigate("student/$studentId") { popUpTo("student/$studentId") { inclusive = true } } }
            )
        }
        composable("quiz/{studentId}/{moduleId}") {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            val moduleId = it.arguments?.getString("moduleId").orEmpty()
            QuizScreen(
                viewModel = viewModel,
                studentId = studentId,
                moduleId = moduleId,
                onBack = { nav.popBackStack() },
                onFinished = { nav.navigate("modules/$studentId") { popUpTo("modules/$studentId") { inclusive = true } } }
            )
        }
        composable("quizResult/{studentId}") {
            val studentId = it.arguments?.getString("studentId").orEmpty()
            QuizResultScreen(
                viewModel = viewModel,
                onDashboard = { nav.navigate("student/$studentId") { popUpTo("student/$studentId") { inclusive = true } } }
            )
        }
        composable("teacherLogin") {
            TeacherLoginScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onLogin = { nav.navigate("teacher") { popUpTo("teacherLogin") { inclusive = true } } }
            )
        }
        composable("teacher") {
            TeacherDashboardScreen(
                viewModel = viewModel,
                onBack = { nav.navigate("role") { popUpTo("role") { inclusive = true } } },
                onRecordBook = teacherRecordBook,
                onScanner = teacherScanner,
                onGurobot = teacherGurobot,
                onStudentView = teacherStudentView,
                onStudentSelected = { nav.navigate("studentPerformance/$it") }
            )
        }
        composable("recordBook") {
            RecordBookScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onRecordBook = teacherRecordBook,
                onScanner = teacherScanner,
                onGurobot = teacherGurobot,
                onStudentView = teacherStudentView,
                onStudentSelected = { nav.navigate("studentPerformance/$it") }
            )
        }
        composable("teacherScanner") {
            TeacherScannerScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onRecordBook = teacherRecordBook,
                onScanner = teacherScanner,
                onGurobot = teacherGurobot,
                onStudentView = teacherStudentView
            )
        }
        composable("teacherStudentView") {
            TeacherStudentViewScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onOpenModule = { nav.navigate("teacherPreviewLesson/$it") },
                onRecordBook = teacherRecordBook,
                onScanner = teacherScanner,
                onGurobot = teacherGurobot,
                onStudentView = teacherStudentView
            )
        }
        composable("teacherPreviewLesson/{moduleId}", listOf(navArgument("moduleId") { type = NavType.StringType })) {
            LessonPreviewScreen(
                viewModel = viewModel,
                moduleId = it.arguments?.getString("moduleId").orEmpty(),
                onBack = { nav.popBackStack() }
            )
        }
        composable("studentPerformance/{studentId}", listOf(navArgument("studentId") { type = NavType.StringType })) {
            StudentPerformanceScreen(
                viewModel = viewModel,
                studentId = it.arguments?.getString("studentId").orEmpty(),
                onBack = { nav.popBackStack() }
            )
        }
        composable("lessonPlans") {
            LessonPlanLibraryScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onGurobot = { nav.navigate("gurobot") }
            )
        }
        composable("gurobot") {
            GurobotScreen(
                viewModel = viewModel,
                onBack = { nav.popBackStack() },
                onRecordBook = teacherRecordBook,
                onScanner = teacherScanner,
                onGurobot = teacherGurobot,
                onStudentView = teacherStudentView
            )
        }
        composable("sync/{mode}/{studentId}") {
            SyncScreen(
                viewModel = viewModel,
                mode = it.arguments?.getString("mode").orEmpty(),
                studentId = it.arguments?.getString("studentId").orEmpty(),
                onBack = { nav.popBackStack() }
            )
        }
    }
}
