import mysql.connector
from flask import request


def get_connection():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        port=3306,
        password="aSd13b5SMn9",
        database="ids_system"
    )