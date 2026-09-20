import pandas as pd
from typing import List
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

class CSVLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        try:
            # Try reading with pandas, auto-detecting separator if needed
            df = None
            for sep in [",", ";", "\t", "|"]:
                try:
                    candidate_df = pd.read_csv(file_path, sep=sep, encoding="utf-8")
                    if len(candidate_df.columns) > 1 or df is None:
                        df = candidate_df
                        if len(candidate_df.columns) > 1:
                            break
                except Exception:
                    continue

            if df is None or df.empty:
                # Fallback to standard utf-8 / latin-1
                df = pd.read_csv(file_path, encoding="latin-1")

            contents: List[DocumentContent] = []
            columns = [str(c).strip() for c in df.columns]

            # Generate statistical summary chunk for deterministic computation
            summary_parts = [
                f"CSV Dataset Summary for '{filename}':",
                f"- Total Rows: {len(df)}",
                f"- Columns: {', '.join(columns)}",
            ]

            # Compute numerical summaries
            num_cols = df.select_dtypes(include=["number"]).columns.tolist()
            if num_cols:
                summary_parts.append("\nNumerical Column Statistics:")
                for col in num_cols:
                    s = df[col].dropna()
                    if not s.empty:
                        summary_parts.append(
                            f"  * {col}: Count={len(s)}, Mean={s.mean():.2f}, Min={s.min()}, Max={s.max()}, Sum={s.sum():.2f}"
                        )

            contents.append(
                DocumentContent(
                    text="\n".join(summary_parts),
                    metadata={
                        "filename": filename,
                        "source": filename,
                        "row_range": f"Summary (1-{len(df)})",
                        "section": "Dataset Summary",
                        "format": "csv"
                    }
                )
            )

            # Group rows into batches (e.g. 15-20 rows) for searchable representation
            batch_size = 15
            for start_idx in range(0, len(df), batch_size):
                end_idx = min(start_idx + batch_size, len(df))
                batch_df = df.iloc[start_idx:end_idx]

                row_texts = []
                for row_num, (_, row) in enumerate(batch_df.iterrows(), start=start_idx + 1):
                    row_fields = [f"{col}: {row[col]}" for col in columns if pd.notna(row[col])]
                    row_texts.append(f"Record {row_num} -> " + " | ".join(row_fields))

                block_text = f"Dataset: {filename} (Rows {start_idx + 1} to {end_idx})\n" + "\n".join(row_texts)
                contents.append(
                    DocumentContent(
                        text=clean_extracted_text(block_text),
                        metadata={
                            "filename": filename,
                            "source": filename,
                            "row_range": f"{start_idx + 1}-{end_idx}",
                            "format": "csv"
                        }
                    )
                )

            return contents

        except Exception as e:
            raise ValueError(f"Failed to process CSV file '{filename}': {str(e)}")
