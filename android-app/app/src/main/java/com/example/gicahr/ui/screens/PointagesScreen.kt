package com.example.gicahr.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.model.Pointage
import com.example.gicahr.data.model.User
import com.example.gicahr.theme.*
import com.example.gicahr.utils.Localization
import kotlinx.coroutines.launch
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info

@Composable
fun PointagesScreen(
    user: User,
    repository: DataRepository,
    currentLanguage: String
) {
    var pointages by remember { mutableStateOf<List<Pointage>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(user.matricule) {
        coroutineScope.launch {
            try {
                val list = repository.getPointages(user.matricule)
                pointages = list.sortedByDescending { it.date }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // Summary Header Card
        Card(
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(8.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (currentLanguage == "ar") "إجمالي أيام البصم" else "Total Jours Pointés",
                        fontSize = 12.sp,
                        color = TextMuted,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "${pointages.size} " + (if (currentLanguage == "ar") "أيام" else "Jours"),
                        fontSize = 20.sp,
                        color = GicaTeal,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    val anomaliesCount = pointages.count { it.anomalie == 1 }
                    Text(
                        text = if (currentLanguage == "ar") "حالات الخلل" else "Total Anomalies",
                        fontSize = 12.sp,
                        color = TextMuted,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "$anomaliesCount",
                        fontSize = 20.sp,
                        color = if (anomaliesCount > 0) DangerRed else SuccessGreen,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }
        }

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (pointages.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = Localization.getString("no_data", currentLanguage),
                    color = TextMuted,
                    fontSize = 16.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(pointages) { p ->
                    DetailedPointageItem(p = p, currentLanguage = currentLanguage)
                }
            }
        }
    }
}

@Composable
fun DetailedPointageItem(p: Pointage, currentLanguage: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Top Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = p.date,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary
                )
                
                // Shift Type Badge
                val shiftLabel = when (p.shiftType) {
                    "matin" -> if (currentLanguage == "ar") "صباح" else "Matin"
                    "apresmidi" -> if (currentLanguage == "ar") "مساء" else "Après-midi"
                    "nuit" -> if (currentLanguage == "ar") "ليل" else "Nuit"
                    else -> if (currentLanguage == "ar") "عادي" else "Standard"
                }
                val shiftColor = when (p.shiftType) {
                    "matin" -> InfoBlue
                    "apresmidi" -> GicaIndigo
                    "nuit" -> Color(0xFF1E293B)
                    else -> GicaTeal
                }
                Box(
                    modifier = Modifier
                        .background(shiftColor.copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(text = shiftLabel, fontSize = 11.sp, color = shiftColor, fontWeight = FontWeight.Bold)
                }
            }

            Divider(color = MaterialTheme.colorScheme.background)

            // Times Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = Localization.getString("hours_worked", currentLanguage),
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                    Text(
                        text = "${p.heuresTravaillees}h",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = if (currentLanguage == "ar") "الدخول / الخروج" else "Entrée / Sortie", fontSize = 11.sp, color = TextMuted)
                    Text(
                        text = "${p.heureEntree ?: "--:--"} - ${p.heureSortie ?: "--:--"}",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = GicaTeal
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(text = Localization.getString("overtime", currentLanguage), fontSize = 11.sp, color = TextMuted)
                    Text(
                        text = "+${p.heuresSupp}h",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = SuccessGreen
                    )
                }
            }

            // Bottom Alert Row (Lateness or Anomalies)
            if (p.retard > 0 || p.anomalie == 1) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.background, RoundedCornerShape(4.dp))
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (p.retard > 0) {
                        Text(
                            text = "${Localization.getString("lateness", currentLanguage)}: ${p.retard.toInt()} min",
                            fontSize = 12.sp,
                            color = WarningAmber,
                            fontWeight = FontWeight.Bold
                        )
                    } else {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                    if (p.anomalie == 1) {
                        Text(
                            text = if (currentLanguage == "ar") "تنبيه: خلل في البصمة" else "Alerte: Anomalie",
                            fontSize = 12.sp,
                            color = DangerRed,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Calculation Detail Section
            if (!p.notes.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Detail",
                        tint = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = p.notes,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}
