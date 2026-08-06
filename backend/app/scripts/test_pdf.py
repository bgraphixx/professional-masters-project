import sys
import io
import re
import pdfplumber

def clean_amount(val: str) -> float:
    if not val:
        return 0.0
    cleaned = re.sub(r"[^\d\.\-]", "", str(val).strip())
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def parse_pdf(file_path, password=""):
    print(f"--- Parsing {file_path} ---")
    try:
        pdf = pdfplumber.open(file_path, password=password)
    except Exception as e:
        print(f"Error opening pdf: {e}")
        return

    header = None
    date_idx = desc_idx = amount_idx = debit_idx = credit_idx = -1
    rows_to_process = []
    
    opay_transactions = []
    opay_start_pattern = re.compile(r'^(\d{2} [a-zA-Z]{3} \d{4} \d{2}:\d{2}:\d{2})\s+(\d{2} [a-zA-Z]{3} \d{4})(?:\s+(.*))?$')
    opay_end_pattern = re.compile(r'(.*?\s+)?([\d,\.\-]+|--)\s+([\d,\.\-]+|--)\s+([\d,\.\-]+|--)\s+([A-Za-z]+)\s*(\d*)$')

    with pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                current_tx = None
                for line in text.split('\n'):
                    line = line.strip()
                    if not line: continue
                    start_match = opay_start_pattern.match(line)
                    if start_match:
                        if current_tx and current_tx['debit'] is not None:
                            opay_transactions.append(current_tx)
                        current_tx = {'date': start_match.group(2), 'desc': start_match.group(3) or "", 'debit': None, 'credit': None}
                        end_match = opay_end_pattern.search(current_tx['desc'])
                        if end_match:
                            desc = end_match.group(1) or ""
                            current_tx['desc'] = current_tx['desc'][:end_match.start()] + desc
                            current_tx['debit'] = end_match.group(2)
                            current_tx['credit'] = end_match.group(3)
                    elif current_tx and current_tx['debit'] is None:
                        end_match = opay_end_pattern.search(line)
                        if end_match:
                            desc = end_match.group(1) or ""
                            current_tx['desc'] += " " + line[:end_match.start()] + desc
                            current_tx['debit'] = end_match.group(2)
                            current_tx['credit'] = end_match.group(3)
                        else:
                            current_tx['desc'] += " " + line
                if current_tx and current_tx['debit'] is not None:
                    opay_transactions.append(current_tx)

            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    clean_row = [str(c).replace('\n', ' ').strip() if c is not None else "" for c in row]
                    if not any(clean_row):
                        continue
                        
                    if header is None:
                        row_lower = [c.lower() for c in clean_row]
                        has_date = any(x in c for x in ["date"] for c in row_lower)
                        has_desc = any(x in c for x in ["description", "narration", "remarks", "details", "memo"] for c in row_lower)
                        if has_date and has_desc:
                            header = clean_row
                            for i, col in enumerate(row_lower):
                                if "date" in col:
                                    date_idx = i
                                elif any(x in col for x in ("description", "narration", "remarks", "details", "memo")):
                                    desc_idx = i
                                elif any(x in col for x in ("amount", "value", "balance")): 
                                    if "balance" not in col or "amount" in col:
                                        amount_idx = i
                                elif any(x in col for x in ("debit", "withdrawal", "payment")):
                                    debit_idx = i
                                elif any(x in col for x in ("credit", "deposit", "receipt")):
                                    credit_idx = i
                        continue
                    else:
                        rows_to_process.append(clean_row)

    print(f"Found Opay TXs: {len(opay_transactions)}")
    for tx in opay_transactions:
        print(f"Opay TX: {tx}")

    print(f"Found Table Header: {header}")
    print(f"Table rows to process: {len(rows_to_process)}")
    if len(rows_to_process) > 0:
        print(f"Sample table row: {rows_to_process[0]}")
        for i, row in enumerate(rows_to_process):
            if i < 5:
                print(f"Table TX {i}: {row}")
    
    if len(opay_transactions) > 0 and (header is None or len(rows_to_process) < len(opay_transactions)):
        header = True
        date_idx, desc_idx, debit_idx, credit_idx, amount_idx = 0, 1, 2, 3, -1
        rows_to_process = [[tx['date'], tx['desc'].strip(), tx['debit'], tx['credit']] for tx in opay_transactions]

    print(f"Indices: date={date_idx}, desc={desc_idx}, amt={amount_idx}, deb={debit_idx}, cred={credit_idx}")

    parsed = []
    for row in rows_to_process:
        if len(row) <= max(date_idx, desc_idx, amount_idx, debit_idx, credit_idx):
            continue

        raw_date = row[date_idx]
        raw_desc = row[desc_idx].strip()
        if not raw_desc:
            continue

        tx_type = "expense"
        tx_amount = 0.0

        if amount_idx != -1:
            val = clean_amount(row[amount_idx])
            if val < 0:
                tx_type = "expense"
                tx_amount = abs(val)
            elif val > 0:
                tx_type = "income"
                tx_amount = val
            else:
                continue
        else:
            debit_val = clean_amount(row[debit_idx]) if debit_idx != -1 and debit_idx < len(row) else 0.0
            credit_val = clean_amount(row[credit_idx]) if credit_idx != -1 and credit_idx < len(row) else 0.0

            if credit_val > 0.0:
                tx_type = "income"
                tx_amount = credit_val
            elif debit_val > 0.0:
                tx_type = "expense"
                tx_amount = debit_val
            else:
                continue
        parsed.append({'date': raw_date, 'desc': raw_desc, 'amount': tx_amount, 'type': tx_type})

    print(f"Total parsed: {len(parsed)}")
    for i, tx in enumerate(parsed):
        print(f"Parsed {i}: {tx}")

if __name__ == '__main__':
    parse_pdf(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
