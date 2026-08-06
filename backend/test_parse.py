import re

text = """
01 Aug 2026 12:02:53 01 Aug 2026 OWealth Withdrawal(Transaction Payment) -- 16,450.00 16,450.00 Mobile 260801010201262501067777
01 Aug 2026 12:02:53 01 Aug 2026 OPay Card Payment | Chowdeck 16,450.00 -- 0.00 WEB 260801330100262310027398
01 Aug 2026 20:48:32 01 Aug 2026 2232ZYX5 | 307931390796 | NEW DURAK 
ENTERPRISES LCONOIL FILLINLANG
10,000.00 -- 0.00 POS 260801330100285825910631
02 Aug 2026 11:46:38 02 Aug 2026
Transfer to INNOCENT CHUKWUMAEZE 
OLUCHUKWU | Fidelity Bank | 6784355227 | 
Skill Acquisition pledge
20,000.00 -- 0.00 Mobile
100004260802104643167084
393771
"""

lines = text.strip().split('\n')
transactions = []
current_tx = None

# Regex to match the start of a transaction:
# Trans Time (11 chars or 20 chars depending on format), Value Date (11 chars)
# OPay: DD MMM YYYY HH:MM:SS  DD MMM YYYY  Description...
start_pattern = re.compile(r'^(\d{2} [a-zA-Z]{3} \d{4} \d{2}:\d{2}:\d{2})\s+(\d{2} [a-zA-Z]{3} \d{4})\s+(.*)$')
# Regex to match the end of a transaction (amounts, balance, channel, ref)
# This might be on the same line or a subsequent line.
# Format: Debit Credit Balance Channel Ref
# Debit/Credit can be "--" or a number with commas.
end_pattern = re.compile(r'(.*?\s+)?([\d,\.]+|--)\s+([\d,\.]+|--)\s+([\d,\.]+|--)\s+([A-Za-z]+)\s*(\d*)$')

for line in lines:
    line = line.strip()
    if not line:
        continue
    
    start_match = start_pattern.match(line)
    if start_match:
        if current_tx:
            transactions.append(current_tx)
        
        trans_time = start_match.group(1)
        value_date = start_match.group(2)
        rest = start_match.group(3)
        
        current_tx = {
            'date': value_date,
            'description': rest,
            'debit': None,
            'credit': None
        }
        
        # Check if the end of the transaction is on this same line
        end_match = end_pattern.search(rest)
        if end_match:
            # We found amounts on the same line
            desc = end_match.group(1) or ""
            current_tx['description'] = rest[:end_match.start()] + desc
            current_tx['debit'] = end_match.group(2)
            current_tx['credit'] = end_match.group(3)
    elif current_tx and current_tx['debit'] is None:
        # Check if this line contains the amounts
        end_match = end_pattern.search(line)
        if end_match:
            desc = end_match.group(1) or ""
            current_tx['description'] += " " + line[:end_match.start()] + desc
            current_tx['debit'] = end_match.group(2)
            current_tx['credit'] = end_match.group(3)
        else:
            current_tx['description'] += " " + line

if current_tx:
    transactions.append(current_tx)

for tx in transactions:
    print(tx)
