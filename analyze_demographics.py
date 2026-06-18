import json

def analyze():
    with open('data/drug_trends.json') as f:
        data = json.load(f)
    
    years = ["2020", "2021", "2022", "2023", "2024"]
    
    # We want to see total beneficiaries by year, and breakdown
    # plan_overview[prov][year]["demographics"] -> age, sex, etc.
    
    aggregate = {y: {"total": 0, "sex": {}, "age": {}, "geo": {}, "income": {}} for y in years}
    
    for prov, pData in data["plan_overview"].items():
        for year in years:
            if year in pData and "demographics" in pData[year]:
                yData = pData[year]["demographics"]
                
                # aggregate total beneficiaries just to be sure we match
                aggregate[year]["total"] += pData[year]["beneficiaries"]
                
                # aggregate sex
                for k, v in yData["sex"].items():
                    aggregate[year]["sex"][k] = aggregate[year]["sex"].get(k, 0) + v["beneficiaries"]
                # aggregate age
                for k, v in yData["age"].items():
                    aggregate[year]["age"][k] = aggregate[year]["age"].get(k, 0) + v["beneficiaries"]
                # aggregate geo
                for k, v in yData["geography"].items():
                    aggregate[year]["geo"][k] = aggregate[year]["geo"].get(k, 0) + v["beneficiaries"]
                # aggregate income
                for k, v in yData["income_quintile"].items():
                    aggregate[year]["income"][k] = aggregate[year]["income"].get(k, 0) + v["beneficiaries"]

    for year in years:
        print(f"\n--- {year} --- (Total Beneficiaries: {aggregate[year]['total']:,})")
        
        # print Age percentages
        age_tot = sum(aggregate[year]["age"].values())
        print("Age:")
        for k, v in aggregate[year]["age"].items():
            print(f"  {k}: {v:,} ({(v/age_tot*100):.1f}%)")
            
        # print Income percentages
        inc_tot = sum(aggregate[year]["income"].values())
        print("Income:")
        for k, v in sorted(aggregate[year]["income"].items()):
            print(f"  {k}: {v:,} ({(v/inc_tot*100):.1f}%)")

if __name__ == "__main__":
    analyze()
