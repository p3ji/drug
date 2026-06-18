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
    const annualIndicatorSelect = document.getElementById('annual-indicator-select');

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
        annualIndicatorSelect.addEventListener('change', updateAnnualSummary);

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
        const indicator = annualIndicatorSelect.value; // 'spending' or 'beneficiaries'
        const years = ['2020', '2021', '2022', '2023', '2024'];
        const latestYear = '2024';
        
        let latestSpending = 0;
        let latestBeneficiaries = 0;

        let demoSeries = {
            sex: { female: [], male: [] },
            age: { under_25: [], "25_to_44": [], "45_to_64": [], "65_and_older": [] },
            geography: { urban: [], rural: [] },
            income: { q1_lowest: [], q2: [], q3: [], q4: [], q5_highest: [] }
        };

        const pubSp = [];
        const pubBen = [];

        years.forEach(yr => {
            let s = 0, b = 0;
            let d_sex = { female: 0, male: 0 };
            let d_age = { under_25: 0, "25_to_44": 0, "45_to_64": 0, "65_and_older": 0 };
            let d_geo = { urban: 0, rural: 0 };
            let d_inc = { q1_lowest: 0, q2: 0, q3: 0, q4: 0, q5_highest: 0 };

            if (provCode === 'ALL') {
                Object.values(appData.plan_overview).forEach(pData => {
                    if (pData[yr]) { 
                        s += pData[yr].spending; b += pData[yr].beneficiaries; 
                        if (pData[yr].demographics) {
                            const d = pData[yr].demographics;
                            d_sex.female += d.sex.female[indicator]; d_sex.male += d.sex.male[indicator];
                            d_age.under_25 += d.age.under_25[indicator]; d_age["25_to_44"] += d.age["25_to_44"][indicator];
                            d_age["45_to_64"] += d.age["45_to_64"][indicator]; d_age["65_and_older"] += d.age["65_and_older"][indicator];
                            d_geo.urban += d.geography.urban[indicator]; d_geo.rural += d.geography.rural[indicator];
                            d_inc.q1_lowest += d.income_quintile.q1_lowest[indicator]; d_inc.q2 += d.income_quintile.q2[indicator];
                            d_inc.q3 += d.income_quintile.q3[indicator]; d_inc.q4 += d.income_quintile.q4[indicator];
                            d_inc.q5_highest += d.income_quintile.q5_highest[indicator];
                        }
                    }
                });
            } else {
                if (appData.plan_overview[provCode] && appData.plan_overview[provCode][yr]) {
                    const pDataYr = appData.plan_overview[provCode][yr];
                    s = pDataYr.spending; b = pDataYr.beneficiaries;
                    if (pDataYr.demographics) {
                        const d = pDataYr.demographics;
                        d_sex.female += d.sex.female[indicator]; d_sex.male += d.sex.male[indicator];
                        d_age.under_25 += d.age.under_25[indicator]; d_age["25_to_44"] += d.age["25_to_44"][indicator];
                        d_age["45_to_64"] += d.age["45_to_64"][indicator]; d_age["65_and_older"] += d.age["65_and_older"][indicator];
                        d_geo.urban += d.geography.urban[indicator]; d_geo.rural += d.geography.rural[indicator];
                        d_inc.q1_lowest += d.income_quintile.q1_lowest[indicator]; d_inc.q2 += d.income_quintile.q2[indicator];
                        d_inc.q3 += d.income_quintile.q3[indicator]; d_inc.q4 += d.income_quintile.q4[indicator];
                        d_inc.q5_highest += d.income_quintile.q5_highest[indicator];
                    }
                }
            }

            pubSp.push(s); pubBen.push(b);
            if (yr === latestYear) { latestSpending = s; latestBeneficiaries = b; }

            demoSeries.sex.female.push(d_sex.female); demoSeries.sex.male.push(d_sex.male);
            demoSeries.age.under_25.push(d_age.under_25); demoSeries.age["25_to_44"].push(d_age["25_to_44"]);
            demoSeries.age["45_to_64"].push(d_age["45_to_64"]); demoSeries.age["65_and_older"].push(d_age["65_and_older"]);
            demoSeries.geography.urban.push(d_geo.urban); demoSeries.geography.rural.push(d_geo.rural);
            demoSeries.income.q1_lowest.push(d_inc.q1_lowest); demoSeries.income.q2.push(d_inc.q2);
            demoSeries.income.q3.push(d_inc.q3); demoSeries.income.q4.push(d_inc.q4); demoSeries.income.q5_highest.push(d_inc.q5_highest);
        });

        document.getElementById('annual-spending').textContent = formatCurrency(latestSpending);
        document.getElementById('annual-beneficiaries').textContent = formatPeople(latestBeneficiaries);
        
        const perClientEl = document.getElementById('annual-per-client-spending');
        if (latestSpending > 0 && latestBeneficiaries > 0) {
            perClientEl.textContent = `$${((latestSpending * 1000000) / latestBeneficiaries).toFixed(2)}`;
        } else {
            perClientEl.textContent = 'N/A';
        }

        renderAnnualChart(years, pubSp, pubBen);
        renderDemographics(demoSeries, years, indicator);
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

    function renderDemographics(demo, years, indicator) {
        const createLineChart = (ctxId, instance, datasets, title) => {
            const ctx = document.getElementById(ctxId).getContext('2d');
            if (instance) instance.destroy();
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: years,
                    datasets: datasets
                },
                options: {
                    responsive: true, 
                    maintainAspectRatio: false, 
                    scales: {
                        x: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#9ca3af', font: {size: 10} } },
                        y: { 
                            grid: { color: 'rgba(255, 255, 255, 0.04)' },
                            ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } },
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: {color: '#9ca3af', boxWidth: 10, font: {size: 10}} },
                        title: { display: true, text: title, color: '#e5e7eb', font: {family: 'Inter', size: 11} },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        let val = context.parsed.y;
                                        
                                        // Calculate total for this year to get percentage
                                        let total = 0;
                                        context.chart.data.datasets.forEach(ds => {
                                            total += ds.data[context.dataIndex] || 0;
                                        });

                                        if (indicator === 'spending') {
                                            if (val >= 1000) {
                                                label += '$' + (val / 1000).toFixed(2) + 'B';
                                            } else {
                                                label += '$' + val.toFixed(1) + 'M';
                                            }
                                        } else {
                                            if (val >= 1000000) {
                                                label += (val / 1000000).toFixed(2) + 'M people';
                                            } else {
                                                label += val.toLocaleString() + ' people';
                                            }
                                        }
                                        
                                        // Append percentage
                                        if (total > 0) {
                                            let pct = ((val / total) * 100).toFixed(1);
                                            label += ` (${pct}%)`;
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

        if (!demo) return;

        const lineOptions = { tension: 0.3, borderWidth: 2, pointRadius: 2, fill: false };

        demoSexChartInstance = createLineChart('demoSexChart', demoSexChartInstance, [
            { label: 'Female', data: demo.sex.female, borderColor: '#bf5af2', backgroundColor: '#bf5af2', ...lineOptions },
            { label: 'Male', data: demo.sex.male, borderColor: '#3b82f6', backgroundColor: '#3b82f6', ...lineOptions }
        ], 'By Sex');

        demoAgeChartInstance = createLineChart('demoAgeChart', demoAgeChartInstance, [
            { label: '<25', data: demo.age.under_25, borderColor: '#00f2fe', backgroundColor: '#00f2fe', ...lineOptions },
            { label: '25-44', data: demo.age["25_to_44"], borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', ...lineOptions },
            { label: '45-64', data: demo.age["45_to_64"], borderColor: '#6366f1', backgroundColor: '#6366f1', ...lineOptions },
            { label: '65+', data: demo.age["65_and_older"], borderColor: '#a855f7', backgroundColor: '#a855f7', ...lineOptions }
        ], 'By Age');

        demoGeoChartInstance = createLineChart('demoGeoChart', demoGeoChartInstance, [
            { label: 'Urban', data: demo.geography.urban, borderColor: '#10b981', backgroundColor: '#10b981', ...lineOptions },
            { label: 'Rural', data: demo.geography.rural, borderColor: '#f59e0b', backgroundColor: '#f59e0b', ...lineOptions }
        ], 'By Geography');

        demoIncomeChartInstance = createLineChart('demoIncomeChart', demoIncomeChartInstance, [
            { label: 'Q1 (Lowest)', data: demo.income.q1_lowest, borderColor: '#ef4444', backgroundColor: '#ef4444', ...lineOptions },
            { label: 'Q2', data: demo.income.q2, borderColor: '#f97316', backgroundColor: '#f97316', ...lineOptions },
            { label: 'Q3', data: demo.income.q3, borderColor: '#eab308', backgroundColor: '#eab308', ...lineOptions },
            { label: 'Q4', data: demo.income.q4, borderColor: '#22c55e', backgroundColor: '#22c55e', ...lineOptions },
            { label: 'Q5 (Highest)', data: demo.income.q5_highest, borderColor: '#14b8a6', backgroundColor: '#14b8a6', ...lineOptions }
        ], 'By Income Quintile');
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
