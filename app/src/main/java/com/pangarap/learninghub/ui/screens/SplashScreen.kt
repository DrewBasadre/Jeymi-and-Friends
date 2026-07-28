package com.pangarap.learninghub.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.gif.AnimatedImageDecoder
import coil3.request.ImageRequest
import com.pangarap.learninghub.R
import com.pangarap.learninghub.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val context = LocalContext.current
    var visible by remember { mutableStateOf(true) }

    val imageLoader = remember {
        ImageLoader.Builder(context)
            .components {
                add(AnimatedImageDecoder.Factory())
            }
            .build()
    }

    LaunchedEffect(Unit) {
        delay(3500) // Show splash for 3.5 seconds
        visible = false
        delay(500)  // Fade-out duration
        onFinished()
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Surface),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(32.dp)
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(R.raw.splash_animation)
                        .build(),
                    imageLoader = imageLoader,
                    contentDescription = "Loading animation",
                    modifier = Modifier.size(240.dp)
                )

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "WAIS",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                    color = Indigo900
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Loading your learning experience…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = OnSurfaceVariant
                )
            }
        }
    }
}
