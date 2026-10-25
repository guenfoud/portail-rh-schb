package com.example.gicahr.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.model.User
import com.example.gicahr.theme.GicaTeal
import com.example.gicahr.theme.TextMuted
import com.example.gicahr.theme.TextPrimary
import com.example.gicahr.theme.TextSecondary
import com.example.gicahr.utils.Localization
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeamScreen(
    user: User,
    repository: DataRepository,
    currentLanguage: String
) {
    var employees by remember { mutableStateOf<List<User>>(emptyList()) }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    var selectedEmployeeForRequest by remember { mutableStateOf<User?>(null) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(user.departement) {
        coroutineScope.launch {
            try {
                val allEmployees = repository.getEmployees()
                // Filter: Supervisors see their department, HR sees all
                employees = if (user.role == "hr") {
                    allEmployees
                } else {
                    allEmployees.filter { it.departement == user.departement && it.matricule != user.matricule }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    val filteredEmployees = employees.filter {
        it.nom.contains(searchQuery, ignoreCase = true) ||
        it.prenom.contains(searchQuery, ignoreCase = true) ||
        it.matricule.contains(searchQuery)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(if (currentLanguage == "ar") "البحث عن موظف..." else "Rechercher un collaborateur...") },
            leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = "Search") },
            shape = RoundedCornerShape(8.dp),
            singleLine = true
        )

        if (isLoading) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (filteredEmployees.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(text = Localization.getString("no_data", currentLanguage), color = TextMuted)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredEmployees) { emp ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedEmployeeForRequest = emp },
                        shape = RoundedCornerShape(8.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(16.dp)
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    text = "${emp.prenom} ${emp.nom}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "${Localization.getString("matricule", currentLanguage)}: ${emp.matricule} • ${emp.poste}",
                                    fontSize = 12.sp,
                                    color = TextSecondary
                                )
                                Text(
                                    text = "${Localization.getString("departement", currentLanguage)}: ${emp.departement}",
                                    fontSize = 11.sp,
                                    color = TextMuted
                                )
                            }

                            // FAB icon indicating action is possible
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Saisir Demande",
                                tint = GicaTeal
                            )
                        }
                    }
                }
            }
        }
    }

    if (selectedEmployeeForRequest != null) {
        NewRequestDialog(
            user = selectedEmployeeForRequest!!,
            repository = repository,
            currentLanguage = currentLanguage,
            onDismiss = { selectedEmployeeForRequest = null },
            onSuccess = { selectedEmployeeForRequest = null }
        )
    }
}
