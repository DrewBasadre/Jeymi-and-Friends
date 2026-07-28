package com.pangarap.learninghub

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.*
import com.pangarap.learninghub.ui.LearningHubViewModel
import com.pangarap.learninghub.ui.screens.SplashScreen
import com.pangarap.learninghub.ui.theme.LearningHubTheme
import com.pangarap.learninghub.navigation.LearningHubNav

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<LearningHubViewModel> {
        LearningHubViewModel.Factory((application as LearningHubApplication).container)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LearningHubTheme {
                var showSplash by remember { mutableStateOf(true) }
                if (showSplash) {
                    SplashScreen(onFinished = { showSplash = false })
                } else {
                    LearningHubNav(viewModel)
                }
            }
        }
    }
}
