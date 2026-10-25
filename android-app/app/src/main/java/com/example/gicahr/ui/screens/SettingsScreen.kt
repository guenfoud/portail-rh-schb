package com.example.gicahr.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.model.User
import com.example.gicahr.theme.GicaTeal
import com.example.gicahr.theme.SuccessGreen
import com.example.gicahr.theme.TextMuted
import com.example.gicahr.theme.TextPrimary
import com.example.gicahr.utils.Localization
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    user: User,
    repository: DataRepository,
    currentLanguage: String
) {
    val errorColor = MaterialTheme.colorScheme.error

    var ip by remember { mutableStateOf("192.168.1.201") }
    var port by remember { mutableStateOf("4370") }
    var enabled by remember { mutableStateOf(false) }
    var interval by remember { mutableStateOf("5") }

    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    var isTesting by remember { mutableStateOf(false) }
    var isSyncing by remember { mutableStateOf(false) }

    var feedbackMessage by remember { mutableStateOf<String?>(null) }
    var feedbackColor by remember { mutableStateOf(Color.Unspecified) }

    var originalSettings by remember { mutableStateOf<JsonObject?>(null) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            try {
                val settings = repository.getSettings()
                originalSettings = settings
                val zkteco = settings["zkteco"]?.jsonObject
                
                ip = zkteco?.get("ip")?.jsonPrimitive?.content ?: "192.168.1.201"
                port = zkteco?.get("port")?.jsonPrimitive?.intOrNull?.toString() ?: "4370"
                enabled = zkteco?.get("enabled")?.jsonPrimitive?.booleanOrNull ?: false
                interval = zkteco?.get("interval")?.jsonPrimitive?.intOrNull?.toString() ?: "5"
            } catch (e: Exception) {
                e.printStackTrace()
                feedbackMessage = "Erreur lors du chargement des paramètres"
                feedbackColor = errorColor
            } finally {
                isLoading = false
            }
        }
    }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Info",
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Column {
                        Text(
                            text = if (currentLanguage == "ar") "إعدادات الأجهزة البيومترية" else "Paramètres terminaux biométriques",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = TextPrimary
                        )
                        Text(
                            text = if (currentLanguage == "ar") "قم بتكوين اتصال pointeuse ZKTeco للمزامنة في الوقت الفعلي." else "Configurez la connexion de la pointeuse ZKTeco pour synchroniser en temps réel.",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                    }
                }
            }

            // Main Settings Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = if (currentLanguage == "ar") "pointeuse ZKTeco" else "Pointeuse ZKTeco",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.primary
                    )

                    // IP Field
                    OutlinedTextField(
                        value = ip,
                        onValueChange = { ip = it },
                        label = { Text(if (currentLanguage == "ar") "عنوان IP" else "Adresse IP du Terminal") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp)
                    )

                    // Port Field
                    OutlinedTextField(
                        value = port,
                        onValueChange = { port = it },
                        label = { Text(if (currentLanguage == "ar") "المنفذ" else "Port de communication") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp)
                    )

                    // Enable Switch
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (currentLanguage == "ar") "تفعيل المزامنة التلقائية" else "Activer la synchronisation auto",
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp
                        )
                        Switch(
                            checked = enabled,
                            onCheckedChange = { enabled = it }
                        )
                    }

                    // Interval Field (only if enabled)
                    if (enabled) {
                        OutlinedTextField(
                            value = interval,
                            onValueChange = { interval = it },
                            label = { Text(if (currentLanguage == "ar") "فترة المزامنة (بالدقائق)" else "Intervalle de synch (minutes)") },
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            shape = RoundedCornerShape(8.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Action buttons (Test / Sync)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = {
                                isTesting = true
                                feedbackMessage = null
                                coroutineScope.launch {
                                    try {
                                        val portInt = port.toIntOrNull() ?: 4370
                                        val res = repository.testZkteco(ip, portInt)
                                        if (res.success) {
                                            feedbackMessage = res.message ?: "Connexion test réussie"
                                            feedbackColor = SuccessGreen
                                        } else {
                                            feedbackMessage = res.error ?: "Échec du test de connexion"
                                            feedbackColor = errorColor
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        feedbackMessage = "Erreur réseau: ${e.message}"
                                        feedbackColor = errorColor
                                    } finally {
                                        isTesting = false
                                    }
                                }
                            },
                            enabled = !isTesting && !isSyncing,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                        ) {
                            if (isTesting) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                            } else {
                                Icon(imageVector = Icons.Default.Build, contentDescription = "Test", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(if (currentLanguage == "ar") "اختبار الاتصال" else "Tester", fontSize = 13.sp)
                            }
                        }

                        Button(
                            onClick = {
                                isSyncing = true
                                feedbackMessage = null
                                coroutineScope.launch {
                                    try {
                                        val res = repository.syncZkteco()
                                        if (res.success) {
                                            feedbackMessage = res.message ?: "Synchronisation effectuée"
                                            feedbackColor = SuccessGreen
                                        } else {
                                            feedbackMessage = res.error ?: "Échec de la synchronisation"
                                            feedbackColor = errorColor
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        feedbackMessage = "Erreur: ${e.message}"
                                        feedbackColor = errorColor
                                    } finally {
                                        isSyncing = false
                                    }
                                }
                            },
                            enabled = !isTesting && !isSyncing && enabled,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = GicaTeal)
                        ) {
                            if (isSyncing) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                            } else {
                                Icon(imageVector = Icons.Default.Refresh, contentDescription = "Sync", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(if (currentLanguage == "ar") "مزامنة الآن" else "Synchro", fontSize = 13.sp)
                            }
                        }
                    }
                }
            }

            // Feedback Message Alert Box
            feedbackMessage?.let { msg ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = feedbackColor.copy(alpha = 0.1f))
                ) {
                    Text(
                        text = msg,
                        modifier = Modifier.padding(12.dp),
                        color = if (feedbackColor == SuccessGreen) SuccessGreen else errorColor,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            // Save Settings Button
            Button(
                onClick = {
                    isSaving = true
                    feedbackMessage = null
                    coroutineScope.launch {
                        try {
                            val updatedZkteco = buildJsonObject {
                                put("ip", ip)
                                put("port", port.toIntOrNull() ?: 4370)
                                put("enabled", enabled)
                                put("interval", interval.toIntOrNull() ?: 5)
                            }

                            val merged = buildJsonObject {
                                originalSettings?.forEach { (key, value) ->
                                    if (key == "zkteco") {
                                        put("zkteco", updatedZkteco)
                                    } else {
                                        put(key, value)
                                    }
                                }
                                if (originalSettings?.containsKey("zkteco") != true) {
                                    put("zkteco", updatedZkteco)
                                }
                            }

                            val res = repository.saveSettings(merged)
                            if (res.success) {
                                feedbackMessage = "Configuration enregistrée avec succès !"
                                feedbackColor = SuccessGreen
                                originalSettings = merged
                            } else {
                                feedbackMessage = res.error ?: "Erreur d'enregistrement"
                                feedbackColor = errorColor
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            feedbackMessage = "Erreur: ${e.message}"
                            feedbackColor = errorColor
                        } finally {
                            isSaving = false
                        }
                    }
                },
                enabled = !isSaving,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isSaving) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Icon(imageVector = Icons.Default.Check, contentDescription = "Enregistrer")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (currentLanguage == "ar") "حفظ الإعدادات" else "Enregistrer la Configuration", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
