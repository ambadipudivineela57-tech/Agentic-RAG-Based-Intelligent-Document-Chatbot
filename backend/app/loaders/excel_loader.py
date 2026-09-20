import pandas as pd
from typing import List
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

class ExcelLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        contents: List[DocumentContent] = []
        try:
            excel_file = pd.ExcelFile(file_path)
            sheet_names = excel_file.sheet_names

            for sheet_name in sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                if df.empty:
                    continue

                columns = [str(c).strip() for c in df.columns]

                # Statistical summary chunk for this sheet
                summary_parts = [
                    f"Excel Document: '{filename}' | Sheet: '{sheet_name}'",
                    f"- Total Records: {len(df)}",
                    f"- Columns: {', '.join(columns)}",
                ]

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
                            "sheet": sheet_name,
                            "section": f"Sheet '{sheet_name}' Summary",
                            "format": "excel"
                        }
                    )
                )

                # Batch rows
                batch_size = 15
                for start_idx in range(0, len(df), batch_size):
                    end_idx = min(start_idx + batch_size, len(df))
                    batch_df = df.iloc[start_idx:end_idx]

                    row_texts = []
                    for row_num, (_, row) in enumerate(batch_df.iterrows(), start=start_idx + 1):
                        row_fields = [f"{col}: {row[col]}" for col in columns if pd.notna(row[col])]
                        row_texts.append(f"Row {row_num} -> " + " | ".join(row_fields))

                    block_text = f"Sheet: {sheet_name} (Rows {start_idx + 1} to {end_idx})\n" + "\n".join(row_texts)
                    contents.append(
                        DocumentContent(
                            text=clean_extracted_text(block_text),
                            metadata={
                                "filename": filename,
                                "source": filename,
                                "sheet": sheet_name,
                                "row_range": f"{start_idx + 1}-{end_idx}",
                                "format": "excel"
                            }
                        )
                    )

            if not contents:
                raise ValueError(f"Excel file '{filename}' contains no readable sheets or data.")

            return contents

        except Exception as e:
            raise ValueError(f"Failed to parse Excel file '{filename}': {str(e)}")
