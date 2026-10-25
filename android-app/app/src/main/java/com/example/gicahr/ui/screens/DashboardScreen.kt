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

@Composable
fun DashboardScreen(
    user: User,
    repository: DataRepository,
    currentLanguage: String
) {
    var pointages by remember { mutableStateOf<List<Pointage>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var stats by remember { mutableStateOf(PointageStats()) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(user.matricule) {
        coroutineScope.launch {
            try {
                val list = repository.getPointages(user.matricule)
                pointages = list.sortedByDescending { it.date }
                
                // Calculate stats
                var totalHours = 0.0
                var totalOvertime = 0.0
                var totalRetard = 0.0
                var anomaliesCount = 0
                for (p in list) {
                    totalHours += p.heuresTravaillees
                    totalOvertime += p.heuresSupp
                    totalRetard += p.retard
                    if (p.anomalie == 1) {
                        anomaliesCount++
                    }
                }
                stats = PointageStats(totalHours, totalOvertime, totalRetard, anomaliesCount)
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Welcome Header
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = if (currentLanguage == "ar") "مرحباً بك،" else "Bonjour,",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 14.sp
                    )
                    Text(
                        text = "${user.prenom} ${user.nom}",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${Localization.getString("matricule", currentLanguage)}: ${user.matricule} • ${
                            when (user.role) {
                                "hr" -> Localization.getString("role_hr", currentLanguage)
                                "supervisor" -> Localization.getString("role_supervisor", currentLanguage)
                                else -> Localization.getString("role_employee", currentLanguage)
                            }
                        }",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        // Balances Row (Leave and Recovery)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                BalanceCard(
                    title = Localization.getString("solde_conge", currentLanguage),
                    value = "${user.soldeConge} " + (if (currentLanguage == "ar") "يوم" else "J"),
                    color = GicaIndigo,
                    modifier = Modifier.weight(1f)
                )
                BalanceCard(
                    title = Localization.getString("solde_recup", currentLanguage),
                    value = "${user.soldeRecuperation} " + (if (currentLanguage == "ar") "ساعة" else "H"),
                    color = GicaTeal,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Stats Title
        item {
            Text(
                text = if (currentLanguage == "ar") "إحصائيات الحضور" else "Statistiques de présence",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        // Stats Grid (4 Cards)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        title = Localization.getString("hours_worked", currentLanguage),
                        value = "${String.format("%.1f", stats.hoursWorked)}h",
                        color = InfoBlue,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = Localization.getString("overtime", currentLanguage),
                        value = "${String.format("%.1f", stats.overtime)}h",
                        color = SuccessGreen,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        title = Localization.getString("lateness", currentLanguage),
                        value = "${stats.retard.toInt()} min",
                        color = WarningAmber,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = Localization.getString("anomalies", currentLanguage),
                        value = "${stats.anomalies}",
                        color = DangerRed,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Recent Activity Title
        item {
            Text(
                text = if (currentLanguage == "ar") "النشاط الأخير" else "Activité récente",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        if (isLoading) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
        } else if (pointages.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Text(
                        text = Localization.getString("no_data", currentLanguage),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        textAlign = TextAlign.Center,
                        color = TextMuted
                    )
                }
            }
        } else {
            // Show top 3 recent pointages
            items(pointages.take(3)) { p ->
                PointageItem(p = p, currentLanguage = currentLanguage)
            }
        }
    }
}

@Composable
fun BalanceCard(title: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(text = title, fontSize = 12.sp, color = TextMuted, fontWeight = FontWeight.Medium)
            Text(text = value, fontSize = 20.sp, color = color, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
fun StatCard(title: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(color, RoundedCornerShape(4.dp))
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(text = title, fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.Normal)
                Text(text = value, fontSize = 16.sp, color = TextPrimary, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun PointageItem(p: Pointage, currentLanguage: String) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(text = p.date, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(
                    text = "${Localization.getString("hours_worked", currentLanguage)}: ${p.heuresTravaillees}h",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "${p.heureEntree ?: "--:--"} - ${p.heureSortie ?: "--:--"}",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = GicaTeal
                )
                if (p.anomalie == 1) {
                    Text(
                        text = if (currentLanguage == "ar") "خلل" else "Anomalie",
                        fontSize = 11.sp,
                        color = DangerRed,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

data class PointageStats(
    val hoursWorked: Double = 0.0,
    val overtime: Double = 0.0,
    val retard: Double = 0.0,
    val anomalies: Int = 0
)
