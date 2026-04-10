# API Candidatos

Existe una API pública de candidatos. El problema es que solo maneja 500 por página, debe hacerse iterativamente el fetch una vez que se carga la aplicación:

Todos los senadores:
/v1/candidates?type=senador&page=1&pageSize=500
Todos los vicepresidentes:
/v1/candidates?type=vicepresidente&page=1&pageSize=500
Todos los diputados:
/v1/candidates?type=diputado&page=1&pageSize=500