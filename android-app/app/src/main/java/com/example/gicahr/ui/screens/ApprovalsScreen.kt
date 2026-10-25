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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.model.Absence
import com.example.gicahr.data.model.Recuperation
import com.example.gicahr.data.model.User
import com.example.gicahr.theme.*
import com.example.gicahr.utils.Localization
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ApprovalsScreen(
    user: User,
    repository: DataRepository,
    currentLanguage: String
) {
    var selectedTab by remember { mutableStateOf(0) }
    var pendingAbsences by remember { mutableStateOf<List<Absence>>(emptyList()) }
    var pendingRecuperations by remember { mutableStateOf<List<Recuperation>>(emptyList()) }
    var employeesMap by remember { mutableStateOf<Map<String, User>>(emptyMap()) }
    var isLoading by remember { mutableStateOf(true) }

    val coroutineScope = rememberCoroutineScope()

    val refreshData = {
        coroutineScope.launch {
            isLoading = true
            try {
                // Fetch employees to resolve names
                val employees = repository.getEmployees()
                employeesMap = employees.associateBy { it.matricule }

                // Fetch all requests
                val allAbsences = repository.getAbsences()
                val allRecups = repository.getRecuperations()

                // Filter: En attente, and depending on department for supervisors, or all for HR
                val filteredAbsences = if (user.role == "hr") {
                    allAbsences.filter { it.statut == "En attente" }
                } else {
                    allAbsences.filter { it.statut == "En attente" && employeesMap[it.matricule]?.departement == user.departement }
                }

                val filteredRecups = if (user.role == "hr") {
                    allRecups.filter { it.statut == "En attente" }
                } else {
                    allRecups.filter { it.statut == "En attente" && employeesMap[it.matricule]?.departement == user.departement }
                }

                pendingAbsences = filteredAbsences.sortedByDescending { it.dateDemande }
                pendingRecuperations = filteredRecups.sortedByDescending { it.dateDemande }

            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(user.matricule) {
        refreshData()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = selectedTab) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = { Text(Localization.getString("absences", currentLanguage), fontWeight = FontWeight.Bold) }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = { Text(Localization.getString("recuperations", currentLanguage), fontWeight = FontWeight.Bold) }
            )
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            if (selectedTab == 0) {
                PendingAbsencesList(
                    absences = pendingAbsences,
                    employeesMap = employeesMap,
                    currentLanguage = currentLanguage,
                    onDecision = { absence, approved ->
                        coroutineScope.launch {
                            try {
                                val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                val updated = absence.copy(
                                    statut = if (approved) "Approuvé" else "Refusé",
                                    decidePar = "${user.prenom} ${user.nom}",
                                    dateDecision = today
                                )
                                repository.saveAbsence(updated)
                                refreshData()
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                )
            } else {
                PendingRecuperationsList(
                    recuperations = pendingRecuperations,
                    employeesMap = employeesMap,
                    currentLanguage = currentLanguage,
                    onDecision = { recup, approved ->
                        coroutineScope.launch {
                            try {
                                val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                val updated = recup.copy(
                                    statut = if (approved) "Approuvé" else "Refusé",
                                    decidePar = "${user.prenom} ${user.nom}",
                                    dateDecision = today
                                )
                                repository.saveRecuperation(updated)
                                refreshData()
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun PendingAbsencesList(
    absences: List<Absence>,
    employeesMap: Map<String, User>,
    currentLanguage: String,
    onDecision: (Absence, Boolean) -> Unit
) {
    if (absences.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(text = Localization.getString("no_data", currentLanguage), color = TextMuted)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(absences) { a ->
                val empName = employeesMap[a.matricule]?.let { "${it.prenom} ${it.nom}" } ?: a.matricule
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(text = empName, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                        Text(
                            text = "${Localization.getString("type_conge", currentLanguage)}: ${a.typeConge}",
                            fontSize = 13.sp,
                            color = TextSecondary
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                text = "${Localization.getString("date_debut", currentLanguage)}: ${a.dateDebut}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                            Text(
                                text = "${Localization.getString("date_fin", currentLanguage)}: ${a.dateFin}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }
                        Text(
                            text = "${Localization.getString("duration_days", currentLanguage)}: ${a.dureeJours}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = GicaTeal
                        )
                        a.motif?.let {
                            Text(
                                text = "${Localization.getString("motif", currentLanguage)}: $it",
                                fontSize = 13.sp,
                                color = TextMuted
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { onDecision(a, true) },
                                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(Localization.getString("approve", currentLanguage), fontWeight = FontWeight.Bold)
                            }
                            Button(
                                onClick = { onDecision(a, false) },
                                colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(Localization.getString("reject", currentLanguage), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PendingRecuperationsList(
    recuperations: List<Recuperation>,
    employeesMap: Map<String, User>,
    currentLanguage: String,
    onDecision: (Recuperation, Boolean) -> Unit
) {
    if (recuperations.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(text = Localization.getString("no_data", currentLanguage), color = TextMuted)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(recuperations) { r ->
                val empName = employeesMap[r.matricule]?.let { "${it.prenom} ${it.nom}" } ?: r.matricule
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(text = empName, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                text = "${Localization.getString("date_debut", currentLanguage)}: ${r.dateDebut ?: ""}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                            Text(
                                text = "${Localization.getString("date_fin", currentLanguage)}: ${r.dateFin ?: ""}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }
                        Text(
                            text = "${Localization.getString("duration_hours", currentLanguage)}: ${r.duree}h",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = GicaIndigo
                        )
                        Text(
                            text = "${Localization.getString("motif", currentLanguage)}: ${r.motif}",
                            fontSize = 13.sp,
                            color = TextMuted
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { onDecision(r, true) },
                                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(Localization.getString("approve", currentLanguage), fontWeight = FontWeight.Bold)
                            }
                            Button(
                                onClick = { onDecision(r, false) },
                                colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(Localization.getString("reject", currentLanguage), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
