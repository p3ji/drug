/* Dashboard Controller Logic - Drug Utilization Monitoring Dashboard (Real Data V2) */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let appData = null;
    
    // Chart Instances
    let trendChartInstance = null;
    let yoyChartInstance = null;
    let provincialChartInstance = null;
    let annualSpendingChartInstance = null;
    let demoSexChartInstance = null;
    let demoAgeChartInstance = null;
    let demoGeoChartInstance = null;
    let demoIncomeChartInstance = null;
    let nihbTrendChartInstance = null;

    // UI Elements
    const tabButtons = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const drugSelect = document.getElementById('drug-select');
    const provinceSelect = document.getElementById('province-select');
    const annualYearSelect = document.getElementById('annual-year-select');

    // KPI Elements
    const kpiAtc = document.getElementById('kpi-atc');
    const kpiDrugName = document.getElementById('kpi-drug-name');
    const kpiDrugClass = document.getElementById('kpi-drug-class');
    const kpiSpending = document.getElementById('kpi-spending');
    const kpiYoy = document.getElementById('kpi-yoy');
    const kpi5yr = document.getElementById('kpi-5yr');

    const currentDateSpan = document.getElementById('current-date');
    const now = new Date();
    currentDateSpan.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Formatters
    const formatCurrency = (val) => {
        if (val === null || val === undefined) return 'N/A';
        if (val >= 1000) return `$${(val / 1000).toFixed(2)} B`;
        return `$${val.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} M`;
    };
    
    const formatPeople = (val) => {
        if (val === null || val === undefined) return 'N/A';
        if (val >= 1000000) return `${(val / 1000000).toFixed(2)} M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
        return val.toLocaleString();
    };

    const formatPct = (val) => {
        if (val === null || val === undefined) return 'N/A';
        const sign = val > 0 ? '+' : '';
        return `${sign}${val.toFixed(2)}%`;
    };

    // 1. Tab Navigation
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // 2. Fetch Data
    fetch('data/drug_trends.json?t=' + Date.now())
        .then(res => {
            if (!res.ok) throw new Error("Failed to load dataset.");
            return res.json();
        })
        .then(data => {
            appData = data;
            initializeDashboard();
        })
        .catch(err => {
            console.error("Dashboard Init Error:", err);
            kpiDrugName.innerHTML = `<span style="color:red">Error loading dataset</span>`;
        });

    // 3. Initialize Filters
    function initializeDashboard() {
        const metadata = appData.pipeline_metadata;
        const jurisdictions = metadata.jurisdictions;

        // Drug Dropdown
        drugSelect.innerHTML = '';
        Object.entries(metadata.monitored_drugs).forEach(([atc, info]) => {
            const opt = document.createElement('option');
            opt.value = atc;
            opt.textContent = `${info.name} (${atc})`;
            drugSelect.appendChild(opt);
        });

        // Province Dropdown
        provinceSelect.innerHTML = '<option value="ALL">National Trend</option>';
        Object.entries(jurisdictions).forEach(([code, name]) => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${name} (${code})`;
            provinceSelect.appendChild(opt);
        });

        // Bind Events
        drugSelect.addEventListener('change', updateDrugSpecificSection);
        provinceSelect.addEventListener('change', () => {
            updateDrugSpecificSection();
            updateAnnualSummary();
        });
        annualYearSelect.addEventListener('change', updateAnnualSummary);

        buildQualityTable(jurisdictions);
        
        // Initial Render
        updateDrugSpecificSection();
        updateAnnualSummary();
        renderNihbSection();
    }

    // 4. Section 1: Drug Specific Trends
    function updateDrugSpecificSection() {
        if (!appData) return;

        const atc = drugSelect.value;
        const prov = provinceSelect.value;
        const drugData = appData.drug_spending[atc];
        const years = appData.pipeline_metadata.years.map(String);
        
        kpiAtc.textContent = atc;
        kpiDrugName.textContent = drugData.name;
        kpiDrugClass.textContent = drugData.class;

        let latestYear = years[years.length - 1];
        let previousYear = years[years.length - 2];
        let baseYear = years[0];

        // Helper to get spending based on province selection
        const getSpending = (yearStr) => {
            const yData = drugData.annual_data[yearStr];
            if (!yData) return null;
            if (prov === 'ALL') return yData.national_total;
            return yData.by_province[prov] || 0;
        };

        const latestSp = getSpending(latestYear);
        const prevSp = getSpending(previousYear);
        const baseSp = getSpending(baseYear);

        // KPIs
        kpiSpending.textContent = formatCurrency(latestSp);
        
        let yoy = null;
        if (latestSp !== null && prevSp !== null && prevSp > 0) {
            yoy = ((latestSp - prevSp) / prevSp) * 100;
        }
        updateTrendElement(kpiYoy, yoy);

        let fiveYr = null;
        if (latestSp !== null && baseSp !== null && baseSp > 0) {
            fiveYr = ((latestSp - baseSp) / baseSp) * 100;
        }
        updateTrendElement(kpi5yr, fiveYr);

        // Charts
        const seriesData = years.map(y => getSpending(y));
        renderDrugTrendChart(years, seriesData, prov);
        
        const yoyData = years.map((y, i) => {
            if (i === 0) return 0;
            const curr = getSpending(y);
            const prev = getSpending(years[i-1]);
            if (curr && prev) return ((curr - prev) / prev) * 100;
            return 0;
        });
        renderYoyChart(years, yoyData);

        // Provincial Breakdown Chart
        if (prov === 'ALL') {
            const byProv = drugData.annual_data[latestYear].by_province;
            renderProvincialChart(byProv);
        } else {
            // Clear or show empty if specific province is selected
            renderProvincialChart({});
        }
    }

    function updateTrendElement(element, val) {
        if (val === null || val === undefined) {
            element.textContent = 'N/A';
            element.className = 'kpi-trend';
            return;
        }
        const sign = val > 0 ? '+' : '';
        element.innerHTML = val > 0 
            ? `<i class="fa-solid fa-arrow-trend-up"></i> ${sign}${val.toFixed(2)}%`
            : `<i class="fa-solid fa-arrow-trend-down"></i> ${val.toFixed(2)}%`;
        element.className = val > 0 ? 'kpi-trend positive' : 'kpi-trend negative';
    }

    function renderDrugTrendChart(years, data, prov) {
        const ctx = document.getElementById('drugSpendingChart').getContext('2d');
        if (trendChartInstance) trendChartInstance.destroy();

        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: prov === 'ALL' ? 'National Public Spending' : `${prov} Public Spending`,
                    data: data,
                    borderColor: '#bf5af2',
                    backgroundColor: 'rgba(191, 90, 242, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#bf5af2'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#9ca3af' }, 
                         title: { display: true, text: 'Spending ($ Millions CAD)', color: '#9ca3af' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderYoyChart(years, yoyData) {
        const ctx = document.getElementById('yoyChart').getContext('2d');
        if (yoyChartInstance) yoyChartInstance.destroy();

        const colors = yoyData.map(v => v >= 0 ? 'rgba(191, 90, 242, 0.7)' : 'rgba(52, 211, 153, 0.7)');

        yoyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years,
                datasets: [{
                    label: 'YoY % Change',
                    data: yoyData,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#9ca3af' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderProvincialChart(byProv) {
        const ctx = document.getElementById('provincialChart').getContext('2d');
        if (provincialChartInstance) provincialChartInstance.destroy();

        // Sort by value descending
        const sorted = Object.entries(byProv).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(i => i[0]);
        const data = sorted.map(i => i[1]);

        const palette = ['#bf5af2', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'];

        provincialChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['N/A'],
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: data.length ? palette : ['#1e293b'],
                    borderWidth: 1, borderColor: '#0f1422'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 10 } } }
                }
            }
        });
    }


    // 5. Section 2: Annual Plan Overview
    function updateAnnualSummary() {
        if (!appData) return;
        const provCode = provinceSelect.value;
        const year = annualYearSelect.value;
        
        let spending = 0;
        let beneficiaries = 0;
        let demo = null; // We only show demographics if a specific province is selected, or we aggregate

        // We can aggregate national totals if needed
        if (provCode === 'ALL') {
            Object.values(appData.plan_overview).forEach(pData => {
                if (pData[year]) {
                    spending += pData[year].spending;
                    beneficiaries += pData[year].beneficiaries;
                }
            });
            // Demographics aggregation could be done, but for simplicity we'll just show N/A for National Demographics right now
            // or we can write an aggregator. Let's write a quick aggregator.
            demo = { sex: { female: 0, male: 0 }, age: { under_25: 0, "25_to_44": 0, "45_to_64": 0, "65_and_older": 0 }, geography: { urban: 0, rural: 0 }, income_quintile: { q1_lowest: 0, q2: 0, q3: 0, q4: 0, q5_highest: 0 } };
            
            Object.values(appData.plan_overview).forEach(pData => {
                if (pData[year] && pData[year].demographics) {
                    const d = pData[year].demographics;
                    demo.sex.female += d.sex.female.spending; demo.sex.male += d.sex.male.spending;
                    demo.age.under_25 += d.age.under_25.spending; demo.age["25_to_44"] += d.age["25_to_44"].spending;
                    demo.age["45_to_64"] += d.age["45_to_64"].spending; demo.age["65_and_older"] += d.age["65_and_older"].spending;
                    demo.geography.urban += d.geography.urban.spending; demo.geography.rural += d.geography.rural.spending;
                    demo.income_quintile.q1_lowest += d.income_quintile.q1_lowest.spending; demo.income_quintile.q2 += d.income_quintile.q2.spending;
                    demo.income_quintile.q3 += d.income_quintile.q3.spending; demo.income_quintile.q4 += d.income_quintile.q4.spending;
                    demo.income_quintile.q5_highest += d.income_quintile.q5_highest.spending;
                }
            });

        } else {
            const pData = appData.plan_overview[provCode] ? appData.plan_overview[provCode][year] : null;
            if (pData) {
                spending = pData.spending;
                beneficiaries = pData.beneficiaries;
                // Just map spending for the pie charts
                if (pData.demographics) {
                    demo = {
                        sex: { female: pData.demographics.sex.female.spending, male: pData.demographics.sex.male.spending },
                        age: { under_25: pData.demographics.age.under_25.spending, "25_to_44": pData.demographics.age["25_to_44"].spending, "45_to_64": pData.demographics.age["45_to_64"].spending, "65_and_older": pData.demographics.age["65_and_older"].spending },
                        geography: { urban: pData.demographics.geography.urban.spending, rural: pData.demographics.geography.rural.spending },
                        income_quintile: { q1_lowest: pData.demographics.income_quintile.q1_lowest.spending, q2: pData.demographics.income_quintile.q2.spending, q3: pData.demographics.income_quintile.q3.spending, q4: pData.demographics.income_quintile.q4.spending, q5_highest: pData.demographics.income_quintile.q5_highest.spending }
                    };
                }
            }
        }

        document.getElementById('annual-spending').textContent = formatCurrency(spending);
        document.getElementById('annual-beneficiaries').textContent = formatPeople(beneficiaries);
        
        const perClientEl = document.getElementById('annual-per-client-spending');
        if (spending > 0 && beneficiaries > 0) {
            perClientEl.textContent = `$${((spending * 1000000) / beneficiaries).toFixed(2)}`;
        } else {
            perClientEl.textContent = 'N/A';
        }

        // Line Chart Update
        const years = ['2020', '2021', '2022', '2023', '2024'];
        const pubSp = [];
        const pubBen = [];
        years.forEach(yr => {
            let s = 0, b = 0;
            if (provCode === 'ALL') {
                Object.values(appData.plan_overview).forEach(pData => {
                    if (pData[yr]) { s += pData[yr].spending; b += pData[yr].beneficiaries; }
                });
            } else {
                if (appData.plan_overview[provCode] && appData.plan_overview[provCode][yr]) {
                    s = appData.plan_overview[provCode][yr].spending;
                    b = appData.plan_overview[provCode][yr].beneficiaries;
                }
            }
            pubSp.push(s); pubBen.push(b);
        });

        renderAnnualChart(years, pubSp, pubBen);
        renderDemographics(demo);
    }

    function renderAnnualChart(years, spending, patients) {
        const ctx = document.getElementById('annualSpendingChart').getContext('2d');
        if (annualSpendingChartInstance) annualSpendingChartInstance.destroy();

        annualSpendingChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Public Spending ($M)',
                        data: spending,
                        borderColor: '#bf5af2',
                        backgroundColor: 'rgba(191, 90, 242, 0.05)',
                        borderWidth: 3, tension: 0.3, yAxisID: 'ySp', fill: true
                    },
                    {
                        label: 'Active Patients',
                        data: patients,
                        borderColor: '#00f2fe',
                        backgroundColor: 'transparent',
                        borderWidth: 3, tension: 0.2, yAxisID: 'yPat',
                        pointRadius: 4, pointBackgroundColor: '#00f2fe', fill: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9ca3af' } },
                    ySp: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9ca3af' } },
                    yPat: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#00f2fe' } }
                },
                plugins: { legend: { labels: { color: '#9ca3af' } } }
            }
        });
    }

    function renderDemographics(demo) {
        const createBarChart = (ctxId, instance, labels, data, colors, title) => {
            const ctx = document.getElementById(ctxId).getContext('2d');
            if (instance) instance.destroy();
            return new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data, 
                        backgroundColor: colors, 
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true, 
                    maintainAspectRatio: false, 
                    indexAxis: 'y', // Horizontal bar chart
                    scales: {
                        x: { display: false },
                        y: { 
                            grid: { display: false },
                            ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: title, color: '#e5e7eb', font: {family: 'Inter', size: 11} },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.x !== null) {
                                        let val = context.parsed.x;
                                        if (val >= 1000) {
                                            label += '$' + (val / 1000).toFixed(2) + 'B';
                                        } else {
                                            label += '$' + val.toFixed(1) + 'M';
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        };

        if (!demo) {
            demoSexChartInstance = createBarChart('demoSexChart', demoSexChartInstance, ['N/A'], [1], ['#1e293b'], 'By Sex');
            demoAgeChartInstance = createBarChart('demoAgeChart', demoAgeChartInstance, ['N/A'], [1], ['#1e293b'], 'By Age');
            demoGeoChartInstance = createBarChart('demoGeoChart', demoGeoChartInstance, ['N/A'], [1], ['#1e293b'], 'By Geography');
            demoIncomeChartInstance = createBarChart('demoIncomeChart', demoIncomeChartInstance, ['N/A'], [1], ['#1e293b'], 'By Income');
            return;
        }

        demoSexChartInstance = createBarChart('demoSexChart', demoSexChartInstance, 
            ['Female', 'Male'], [demo.sex.female, demo.sex.male], 
            ['#bf5af2', '#3b82f6'], 'By Sex');

        demoAgeChartInstance = createBarChart('demoAgeChart', demoAgeChartInstance, 
            ['<25', '25-44', '45-64', '65+'], [demo.age.under_25, demo.age["25_to_44"], demo.age["45_to_64"], demo.age["65_and_older"]], 
            ['#00f2fe', '#0ea5e9', '#6366f1', '#a855f7'], 'By Age');

        demoGeoChartInstance = createBarChart('demoGeoChart', demoGeoChartInstance, 
            ['Urban', 'Rural'], [demo.geography.urban, demo.geography.rural], 
            ['#10b981', '#f59e0b'], 'By Geography');

        demoIncomeChartInstance = createBarChart('demoIncomeChart', demoIncomeChartInstance, 
            ['Q1 (Lowest)', 'Q2', 'Q3', 'Q4', 'Q5 (Highest)'], 
            [demo.income_quintile.q1_lowest, demo.income_quintile.q2, demo.income_quintile.q3, demo.income_quintile.q4, demo.income_quintile.q5_highest], 
            ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6'], 'By Income Quintile');
    }

    // 6. Section 3: NIHB
    function renderNihbSection() {
        if (!appData || !appData.nihb_data) return;
        const nihb = appData.nihb_data;
        const years = Object.keys(nihb).sort();
        
        // Use 2023 for KPIs since 2024 is projected
        const latestNihb = nihb["2023"];
        
        document.getElementById('nihb-claims').textContent = latestNihb.claims_volume_millions.toFixed(2) + " M";
        document.getElementById('nihb-clients').textContent = formatPeople(latestNihb.beneficiaries);
        document.getElementById('nihb-expenditure').textContent = formatCurrency(latestNihb.spending);

        const spendingArr = years.map(y => nihb[y].spending);
        const claimsArr = years.map(y => nihb[y].claims_volume_millions);

        const ctx = document.getElementById('nihbTrendChart').getContext('2d');
        if (nihbTrendChartInstance) nihbTrendChartInstance.destroy();

        nihbTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Expenditure ($M)',
                        data: spendingArr,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderWidth: 3, tension: 0.3, yAxisID: 'ySp', fill: true
                    },
                    {
                        label: 'Claims Vol (Millions)',
                        data: claimsArr,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderWidth: 3, tension: 0.2, yAxisID: 'yCl',
                        pointRadius: 4, pointBackgroundColor: '#f59e0b', fill: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9ca3af' } },
                    ySp: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#ef4444' } },
                    yCl: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#f59e0b' } }
                },
                plugins: { legend: { labels: { color: '#9ca3af' } } }
            }
        });
    }

    // 7. Quality Table Generator
    function buildQualityTable(provMetadata) {
        const tb = document.getElementById('quality-table-body');
        if (!tb) return;
        tb.innerHTML = '';
        
        Object.keys(provMetadata).forEach(code => {
            const meta = provMetadata[code];
            let statusClass = 'success';
            let confClass = 'success';
            
            if (meta.reporting_quality === 'Medium') { statusClass = 'warning'; confClass = 'warning'; }
            else if (meta.reporting_quality === 'Low') { statusClass = 'danger'; confClass = 'warning'; }
            else if (meta.reporting_quality === 'Very Low') { statusClass = 'danger'; confClass = 'danger'; }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${meta.name} (${code})</strong></td>
                <td><span class="status-pill ${statusClass}">${meta.reporting_quality} Quality</span></td>
                <td>Verified Pipeline Ingestion</td>
                <td>${meta.data_lag_months} Months Lag</td>
                <td><span class="status-pill ${confClass}">${meta.reporting_quality} Confidence</span></td>
            `;
            tb.appendChild(tr);
        });
    }
});
