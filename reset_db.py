# reset_db.py
from sqlalchemy import inspect
from main import app, db

with app.app_context():
    print("DB URI:", app.config['SQLALCHEMY_DATABASE_URI'])
    insp = inspect(db.engine)
    print("Existing tables before:", insp.get_table_names())

    db.drop_all()
    print("Dropped all tables.")

    db.create_all()
    print("Recreated all tables.")

    cols = [c['name'] for c in inspect(db.engine).get_columns('users')]
    print("users columns now:", cols)
