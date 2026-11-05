"""Cria (ou recria) o banco SQLite. Uso: python python/init_db.py [--reset]"""
import sqlite3, sys, pathlib

base = pathlib.Path(__file__).resolve().parent.parent / "database"
db = base / "alienstage.db"
if "--reset" in sys.argv and db.exists():
    db.unlink()
    print("Banco antigo removido.")
con = sqlite3.connect(db)
con.executescript((base / "schema.sql").read_text(encoding="utf-8"))
con.commit()
tabelas = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("Banco pronto em", db, "| tabelas:", tabelas)
con.close()
