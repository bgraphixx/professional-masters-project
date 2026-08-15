"""
Evaluation harness for the transaction-categorisation model.

Fits each candidate configuration on the training partition only and reports
train / validation / test accuracy plus a per-category validation accuracy
breakdown. Reuses the exact same 70/15/15 stratified split (random_state=42)
as app/scripts/seed.py::train_baseline_model — the split itself is never
touched here, only the vectorizer/classifier configuration.

Run with: python -m app.scripts.ml_experiment
"""
import json
import os
from collections import defaultdict

from sklearn.ensemble import VotingClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

from app.core.ml import normalize_narration
from app.scripts.seed import MOCK_TRANSACTIONS_DATA


def get_split():
    # Same normalisation applied at training (seed.py) and inference
    # (app.core.ml.predict_category) time, so this experiment measures the
    # configuration that will actually run in production.
    descriptions = [normalize_narration(item[0]) for item in MOCK_TRANSACTIONS_DATA]
    categories = [item[1] for item in MOCK_TRANSACTIONS_DATA]

    X_train, X_temp, y_train, y_temp = train_test_split(
        descriptions, categories, test_size=0.30, stratify=categories, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
    )
    return X_train, y_train, X_val, y_val, X_test, y_test


def evaluate(pipeline: Pipeline, label: str, split) -> dict:
    X_train, y_train, X_val, y_val, X_test, y_test = split
    pipeline.fit(X_train, y_train)

    train_pred = pipeline.predict(X_train)
    val_pred = pipeline.predict(X_val)
    test_pred = pipeline.predict(X_test)

    per_cat = defaultdict(lambda: [0, 0])
    for true, pred in zip(y_val, val_pred):
        per_cat[true][1] += 1
        if true == pred:
            per_cat[true][0] += 1
    per_cat_acc = {k: round(v[0] / v[1], 4) for k, v in sorted(per_cat.items())}

    result = {
        "label": label,
        "train_accuracy": round(accuracy_score(y_train, train_pred), 4),
        "validation_accuracy": round(accuracy_score(y_val, val_pred), 4),
        "test_accuracy": round(accuracy_score(y_test, test_pred), 4),
        "per_category_validation_accuracy": per_cat_acc,
    }
    return result


def print_result(r: dict):
    print(
        f"{r['label']:<55} train={r['train_accuracy']:.4f}  "
        f"val={r['validation_accuracy']:.4f}  test={r['test_accuracy']:.4f}"
    )


def main():
    split = get_split()
    results = []

    # ── Stage 1: regularisation grid search (word 1-2gram TF-IDF, as-is) ────
    print("\n=== Stage 1: C grid search (word ngram_range=(1,2)) ===")
    best_c, best_c_val = None, -1.0
    for c in [0.001, 0.01, 0.05, 0.1, 0.3, 0.5, 1.0]:
        pipeline = Pipeline([
            ("vectorizer", TfidfVectorizer(lowercase=True, ngram_range=(1, 2))),
            ("classifier", LogisticRegression(C=c, max_iter=1000)),
        ])
        r = evaluate(pipeline, f"LogReg C={c} word(1,2)", split)
        print_result(r)
        results.append(r)
        if r["validation_accuracy"] > best_c_val:
            best_c_val, best_c = r["validation_accuracy"], c
    print(f"-> best C by validation accuracy: {best_c} (val={best_c_val:.4f})")

    # ── Stage 2: vectorizer variants at best C ───────────────────────────────
    print("\n=== Stage 2: vectorizer variants ===")
    vectorizer_variants = {
        "word(1,2)": TfidfVectorizer(lowercase=True, ngram_range=(1, 2)),
        "char_wb(3,5)": TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=(3, 5)),
        "word(1,2)+char_wb(3,5) union": FeatureUnion([
            ("word", TfidfVectorizer(lowercase=True, ngram_range=(1, 2))),
            ("char", TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=(3, 5))),
        ]),
    }
    best_vec_name, best_vec_val = None, -1.0
    for name, vec in vectorizer_variants.items():
        pipeline = Pipeline([
            ("vectorizer", vec),
            ("classifier", LogisticRegression(C=best_c, max_iter=1000)),
        ])
        r = evaluate(pipeline, f"LogReg C={best_c} {name}", split)
        print_result(r)
        results.append(r)
        if r["validation_accuracy"] > best_vec_val:
            best_vec_val, best_vec_name = r["validation_accuracy"], name
    print(f"-> best vectorizer by validation accuracy: {best_vec_name} (val={best_vec_val:.4f})")

    # ── Stage 3: feature space reduction on the best vectorizer family ──────
    print("\n=== Stage 3: max_features / min_df on best vectorizer ===")

    def make_vec(base_name, **kwargs):
        if base_name == "word(1,2)":
            return TfidfVectorizer(lowercase=True, ngram_range=(1, 2), **kwargs)
        elif base_name == "char_wb(3,5)":
            return TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=(3, 5), **kwargs)
        else:
            return FeatureUnion([
                ("word", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), **kwargs)),
                ("char", TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=(3, 5), **kwargs)),
            ])

    best_feat_val = best_vec_val
    best_feat_kwargs = {}
    for max_features in [None, 500, 1000, 2000]:
        for min_df in [1, 2]:
            kwargs = {}
            if max_features is not None:
                kwargs["max_features"] = max_features
            if min_df != 1:
                kwargs["min_df"] = min_df
            if not kwargs:
                continue  # identical to Stage 2's winner, already recorded
            vec = make_vec(best_vec_name, **kwargs)
            pipeline = Pipeline([
                ("vectorizer", vec),
                ("classifier", LogisticRegression(C=best_c, max_iter=1000)),
            ])
            label = f"LogReg C={best_c} {best_vec_name} max_features={max_features} min_df={min_df}"
            r = evaluate(pipeline, label, split)
            print_result(r)
            results.append(r)
            if r["validation_accuracy"] > best_feat_val:
                best_feat_val, best_feat_kwargs = r["validation_accuracy"], kwargs
    print(f"-> best feature-space config: {best_feat_kwargs or '(none beat the unrestricted vectorizer)'} (val={best_feat_val:.4f})")

    best_vectorizer_kwargs = best_feat_kwargs

    # ── Stage 4: alternative classifiers on the best feature configuration ──
    print("\n=== Stage 4: alternative classifiers ===")

    def make_best_vec():
        return make_vec(best_vec_name, **best_vectorizer_kwargs)

    classifiers = {
        "LogisticRegression": LogisticRegression(C=best_c, max_iter=1000),
        "LinearSVC": LinearSVC(C=best_c, max_iter=5000),
        "MultinomialNB": MultinomialNB(),
    }
    clf_results = {}
    for name, clf in classifiers.items():
        pipeline = Pipeline([("vectorizer", make_best_vec()), ("classifier", clf)])
        label = f"{name} (best features)"
        r = evaluate(pipeline, label, split)
        print_result(r)
        results.append(r)
        clf_results[name] = r["validation_accuracy"]

    ranked = sorted(clf_results.items(), key=lambda kv: kv[1], reverse=True)
    print(f"-> classifier ranking by validation accuracy: {ranked}")

    # Voting ensemble over the top two classifiers if no clear single winner.
    top_two = [name for name, _ in ranked[:2]]
    voting_estimators = []
    for name in top_two:
        if name == "LogisticRegression":
            voting_estimators.append((name, LogisticRegression(C=best_c, max_iter=1000)))
        elif name == "LinearSVC":
            # LinearSVC has no predict_proba; use decision_function based voting (hard voting).
            voting_estimators.append((name, LinearSVC(C=best_c, max_iter=5000)))
        elif name == "MultinomialNB":
            voting_estimators.append((name, MultinomialNB()))
    voting = VotingClassifier(estimators=voting_estimators, voting="hard")
    pipeline = Pipeline([("vectorizer", make_best_vec()), ("classifier", voting)])
    r = evaluate(pipeline, f"VotingClassifier({'+'.join(top_two)})", split)
    print_result(r)
    results.append(r)

    best_clf_name = ranked[0][0]
    if r["validation_accuracy"] > clf_results[best_clf_name]:
        best_clf_name = "VotingClassifier"

    # ── Stage 5: class_weight='balanced' on the selected classifier ─────────
    print("\n=== Stage 5: class_weight='balanced' ===")
    if best_clf_name == "LogisticRegression":
        clf_balanced = LogisticRegression(C=best_c, max_iter=1000, class_weight="balanced")
    elif best_clf_name == "LinearSVC":
        clf_balanced = LinearSVC(C=best_c, max_iter=5000, class_weight="balanced")
    elif best_clf_name == "MultinomialNB":
        clf_balanced = None  # MultinomialNB has no class_weight param
    else:
        clf_balanced = None

    if clf_balanced is not None:
        pipeline = Pipeline([("vectorizer", make_best_vec()), ("classifier", clf_balanced)])
        r = evaluate(pipeline, f"{best_clf_name} + class_weight=balanced", split)
        print_result(r)
        results.append(r)
    else:
        print(f"-> {best_clf_name} has no class_weight parameter, skipping.")

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n=== Full comparison table (sorted by validation accuracy) ===")
    for r in sorted(results, key=lambda r: r["validation_accuracy"], reverse=True):
        print_result(r)

    out_path = os.path.join(os.path.dirname(__file__), "..", "ml", "artifacts", "experiment_log.json")
    out_path = os.path.abspath(out_path)
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nFull experiment log written to: {out_path}")

    return results


if __name__ == "__main__":
    main()
