import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}


def text(node):
    return "".join(node.itertext()) if node is not None else ""


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: extract-profile-list.py workbook.xlsm")

    with zipfile.ZipFile(sys.argv[1]) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [text(item) for item in shared_root.findall("m:si", NS)]

        sheets = workbook.find("m:sheets", NS)
        sheet = list(sheets)[1]
        relationship_id = sheet.attrib[f"{{{REL_NS}}}id"]
        relationship = relationships.find(f"r:Relationship[@Id='{relationship_id}']", PKG_REL_NS)
        target = relationship.attrib["Target"].lstrip("/")
        sheet_path = target if target.startswith("xl/") else f"xl/{target}"
        worksheet = ET.fromstring(archive.read(sheet_path))

        extracted = []
        for row in worksheet.findall(".//m:sheetData/m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group(0)
                if column > "P":
                    continue
                kind = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                value = value_node.text if value_node is not None and value_node.text is not None else ""
                if kind == "s" and value:
                    value = shared[int(value)]
                elif kind == "inlineStr":
                    value = text(cell.find("m:is", NS))
                values[column] = value
            if any(str(value).strip() for value in values.values()):
                extracted.append({"row": int(row.attrib["r"]), "values": values})

        date_1904 = workbook.find("m:workbookPr", NS)
        print(json.dumps({
            "sheet": sheet.attrib["name"],
            "date1904": date_1904 is not None and date_1904.attrib.get("date1904") in ("1", "true"),
            "rows": extracted,
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
