# 🐍 Python Exploratory Data Analysis (EDA)

This folder contains Python-based exploratory analysis projects using **Pandas, Matplotlib, and Seaborn**.  
Each notebook focuses on cleaning, analyzing, and visualizing real datasets to uncover insights.

---

## 🤖 AI Usage of Students' Study
- **Tool:** Python (Pandas, Matplotlib, SciPy, Statsmodels)
- **Goal:** Analyze student interactions with AI-assisted learning tools to understand what factors influence continued AI usage.
- **Data:** AI-assisted learning session data containing student discipline, task outcomes, satisfaction ratings, AI assistance level, and reuse behavior.
- **Steps:**  
  - Cleaned and standardized raw session data (outcomes, satisfaction ratings, reuse indicators).
  - Encoded categorical variables such as discipline, task type, and final outcome.
  - Conducted exploratory data analysis to examine relationships between learning outcomes, satisfaction, and AI reuse.
  - Performed statistical tests (Chi-square, t-tests, ANOVA, Kruskal–Wallis) to evaluate associations between variables.
  - Visualized reuse rates, satisfaction distributions, and task completion patterns across outcomes and assistance levels. 

- **Key Findings:**  
  - Final task outcome was the strongest predictor of AI reuse: students who completed tasks or successfully drafted ideas reused AI at much higher rates than those who were confused or        gave up.
  - Satisfaction ratings showed no significant differences across reuse behavior or outcomes, suggesting satisfaction alone does not drive continued AI use.
  - Higher AI assistance levels were associated with modest increases in task completion rates, indicating AI functions best as a supportive learning tool rather than a guarantee of success.
  - Differences in AI reuse patterns suggest that students prioritize task success over subjective experience when deciding whether to reuse AI.

- **File:** [ai-usage-of-student_study_2025.ipynb](./ai-usage-of-student_study_2025.ipynb)
---

## ⛳ Golf Tournament Score Analysis
- **Tool:** Python (Pandas, Matplotlib)
- **Goal:** Analyze golf tournament data to understand scoring trends and player performance.  
- **Data:** AJGA tournament leaderboard data (scraped/cleaned into structured format).  
- **Steps:**  
  - Cleaned raw scores into a structured format (holes, par, strokes).  
  - Computed player averages (per hole, per round).  
  - Identified the toughest/easiest holes based on scoring distribution.  
  - Visualized par performance across different holes and rounds.  

- **Key Findings:**  
  - Par 3 holes tended to be the most challenging.  
  - The back nine showed higher scoring averages than the front nine.  
  - A few standout players consistently performed under par across all rounds.  

- **File:** [AJGA_Golf_Analysis.ipynb](./AJGA_Golf_Analysis.ipynb)

---

## 📊 Planned EDA Projects
- Healthcare dataset analysis (readmission rates, disparities).  
- Mental health survey deep dive.  
- Opioid overdose trends (multi-dataset merge + visualization).  

