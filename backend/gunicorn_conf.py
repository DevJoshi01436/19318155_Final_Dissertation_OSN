# gunicorn_conf.py
bind = "0.0.0.0:5000"
workers = 2
worker_class = "gthread"
threads = 4
timeout = 60
preload_app = True
