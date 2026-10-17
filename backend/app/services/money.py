"""INR formatting with lakh and crore grouping, used in backend messages so they match the UI."""


def inr(value: float | int | None) -> str:
    if value is None:
        return "—"
    sign = "-" if value < 0 else ""
    digits = str(abs(int(round(value))))
    if len(digits) <= 3:
        return f"{sign}₹{digits}"
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return f"{sign}₹{','.join(groups)},{tail}"
