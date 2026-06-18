const fs = require('fs');
const appData = JSON.parse(fs.readFileSync('data/drug_trends.json'));

const indicator = 'spending';
const years = ['2020', '2021', '2022', '2023', '2024'];

let demoSeries = {
    sex: { female: [], male: [] },
    age: { under_25: [], "25_to_44": [], "45_to_64": [], "65_and_older": [] },
    geography: { urban: [], rural: [] },
    income: { q1_lowest: [], q2: [], q3: [], q4: [], q5_highest: [] }
};

years.forEach(yr => {
    let d_sex = { female: 0, male: 0 };
    Object.values(appData.plan_overview).forEach(pData => {
        if (pData[yr] && pData[yr].demographics) {
            const d = pData[yr].demographics;
            d_sex.female += d.sex.female[indicator]; 
            d_sex.male += d.sex.male[indicator];
        }
    });
    demoSeries.sex.female.push(d_sex.female);
    demoSeries.sex.male.push(d_sex.male);
});

console.log(demoSeries.sex);
