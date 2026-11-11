# Placas

App para anotar las placas de los carros que ves en la calle. Funciona en el celular, sin internet y sin servidores: todo queda guardado en el dispositivo en formato CSV.

## Qué hace

- **Anotar**: escribes la placa y se guarda con la fecha y la hora exactas.
- **Coincidencias**: si la placa ya estaba anotada, la app te avisa, te dice cuántas veces la has visto, cuándo fue la primera y la última vez, y cuánto tiempo pasó.
- **Historial**: todos los registros agrupados por día, con buscador y filtro de placas repetidas. Toca una placa para ver todas sus fechas.
- **Estadísticas**: totales, placas distintas, registros de hoy / semana / mes, rachas de días, día con más placas, gráficas por día, por día de la semana y por hora, placas más repetidas y coincidencias recientes.
- **Exportar / importar CSV**: descarga o comparte el archivo, y vuelve a cargarlo combinando o reemplazando los datos.
- **Modo claro y oscuro** con un botón, y animaciones fluidas en toda la app.

## Formato del CSV

```csv
placa,fecha,hora,iso
ABC123,2026-11-11,08:15:42,2026-11-11T08:15:42-05:00
```

Al importar también se aceptan archivos separados por punto y coma y fechas tipo `DD/MM/AAAA`.

## Usarla en el celular

1. En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`.
2. Abre la dirección que te da GitHub Pages desde el celular.
3. En el menú del navegador elige **Agregar a pantalla de inicio / Instalar app**.

Desde ese momento se abre como cualquier otra app y funciona sin conexión.

## Probarla en el computador

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

## Autor

davidhc4
