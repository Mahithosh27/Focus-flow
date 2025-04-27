import json
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split

# Sample Data: [Time Spent (mins), Visits per Day, Work Hours (0/1), Manually Blocked (0/1)]
data = [
    [120, 5, 0, 1],  # Social Media - Blocked
    [30, 3, 1, 0],   # Work-related - Allowed
    [200, 10, 0, 1], # YouTube binge - Blocked
    [10, 1, 1, 0],   # Research - Allowed
    [180, 6, 0, 1],  # Netflix - Blocked
    [15, 2, 1, 0]    # Educational site - Allowed
]

# Labels (1 = Distracting, 0 = Productive)
labels = [1, 0, 1, 0, 1, 0]

# Train Decision Tree Classifier
X_train, X_test, y_train, y_test = train_test_split(data, labels, test_size=0.2, random_state=42)
model = DecisionTreeClassifier()
model.fit(X_train, y_train)

# Extract the decision tree structure
tree_structure = model.tree_

# Convert NumPy arrays to lists for JSON serialization
tree_json = {
    "children_left": tree_structure.children_left.tolist(),
    "children_right": tree_structure.children_right.tolist(),
    "feature": tree_structure.feature.tolist(),
    "threshold": tree_structure.threshold.tolist(),
    "value": tree_structure.value.tolist()  # ✅ Fixed issue here
}

# Save to JSON file
with open("decision_tree.json", "w") as f:
    json.dump(tree_json, f, indent=4)

print("✅ Decision Tree model trained and saved successfully!")
