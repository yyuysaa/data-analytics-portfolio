# 🐍 Python Exploratory Data Analysis (EDA)

This folder contains Python-based exploratory analysis projects.  
Each notebook focuses on cleaning, analyzing, and visualizing real datasets to uncover insights.

---

## 💳 Credit Card Fraud Detection with a Neural Network 
- **Tool:** Python (Pandas, NumPy, Scikit-learn, TensorFlow/Keras, Matplotlib)
- **Goal:** Detect fraudulent credit card transactions in a highly imbalanced dataset while prioritizing fraud recall using precision–recall–based evaluation.
- **Data:** Kaggle credit card transaction dataset containing anonymized PCA features (V1–V28), transaction Time, Amount, and a binary fraud label (Class).
- **Steps:**  
  - Performed stratified train–test split to preserve fraud distribution.
  - Scaled raw features (Time, Amount) using StandardScaler while preventing data leakage.
  - Addressed extreme class imbalance with class weighting to emphasize fraud detection.
  - Built and trained a lightweight neural network with Batch Normalization, Dropout, and Early Stopping.
  - Evaluated performance using Precision–Recall metrics, Average Precision (AP), and classification reports.
  - Analyzed the precision–recall curve to understand threshold tradeoffs between fraud recall and false positives.

- **Key Findings:**  
  - Achieved an Average Precision (AP) of ~0.71, indicating strong performance under severe class imbalance.
  - Detected over 92% of fraudulent transactions, prioritizing recall for rare-event detection.
  - Demonstrated effective tradeoff between fraud detection and false positives, consistent with real-world fraud systems.

- **File:** [credit-card-fraud-detection-with-a-neural-network.ipynb](./credit-card-fraud-detection-with-a-neural-network_matt_2025.ipynb)
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

- **File:** [ai-usage-of-students_study_2025.ipynb](./ai-usage-of-students_study_2025.ipynb)
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



