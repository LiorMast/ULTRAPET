"""staff — The staff panel API (blueprint `staff`, prefix /api/staff).

routes.py holds the blueprint: staff sign-in and create/read/update/delete of the catalog and the site content.
Every route except sign-in requires a signed-in staff user. Registered by create_app (app/__init__.py).
"""
