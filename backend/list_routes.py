from main import app
from fastapi.routing import APIRoute
for route in app.routes:
    if isinstance(route, APIRoute):
        print(f"{route.path} [{','.join(route.methods)}]")
    else:
        print(f"{route.path} [NO METHODS - {type(route).__name__}]")
