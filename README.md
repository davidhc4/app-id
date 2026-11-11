# Placas

App Android para anotar las placas de los carros que ves en la calle. Funciona sin internet: todo queda guardado en el celular en un archivo CSV.

## Qué hace

- **Anotar**: escribes la placa y se guarda con la fecha y la hora exactas.
- **Lugar y descripción** (opcionales): dónde la viste y cualquier detalle. Los lugares usados se sugieren para elegirlos con un toque, y se pueden corregir después desde el detalle de la placa.
- **Patrones**: la app detecta si una placa se repite el mismo día de la semana, a la misma hora o en el mismo lugar, y muestra tus lugares más frecuentes.
- **Coincidencias**: si la placa ya estaba anotada, la app te avisa, te dice cuántas veces la has visto, cuándo fue la primera y la última vez, y cuánto tiempo pasó.
- **Historial**: todos los registros agrupados por día, con buscador (por placa, lugar o descripción) y filtro de placas repetidas. Toca una placa para ver todas sus fechas.
- **Estadísticas**: totales, placas distintas, registros de hoy / semana / mes, rachas de días, día con más placas, gráficas por día, por día de la semana y por hora, placas más repetidas y coincidencias recientes.
- **Exportar / importar CSV**: guarda una copia donde quieras y vuelve a cargarla combinando o reemplazando los datos.
- **Ajustes**: modo claro y oscuro, exportar / importar, actualización de la app y, al final, la versión instalada.
- Animaciones fluidas en toda la app.

## Instalar en el celular

1. Desde el celular entra a la sección **Releases** de este repositorio.
2. Descarga el archivo `placas-vX.X.X.apk` de la versión más reciente.
3. Ábrelo y acepta la instalación (la primera vez Android pide permitir "instalar apps desconocidas" para el navegador o el gestor de archivos).

## Actualizar

No hay que desinstalar nada. Dos formas:

- Dentro de la app: **Ajustes → Actualización → Buscar actualización → Descargar e instalar**.
- O descarga el APK más nuevo desde **Releases** y ábrelo.

El instalador de Android reemplaza la versión anterior y **conserva todas tus placas**. Todas las versiones van firmadas con la misma firma y con un número de versión creciente, por eso se instalan una encima de otra.

> Si desinstalas la app, Android borra también sus datos. Antes de desinstalar, usa **Ajustes → Guardar CSV**.

## Dónde queda el CSV

`Android/data/com.davidhc4.placas/files/placas.csv` en el almacenamiento del celular. Formato:

```csv
placa,fecha,hora,iso,lugar,nota
ABC123,2026-11-11,08:15:42,2026-11-11T08:15:42-05:00,Calle 10,Mazda rojo
```

Al importar también se aceptan archivos separados por punto y coma y fechas tipo `DD/MM/AAAA`.

## Compilar

Cada cambio que se sube al repositorio compila el APK automáticamente y lo publica en **Releases**.

El APK se firma con una llave guardada en los secretos del repositorio (**Settings → Secrets and variables → Actions**): `FIRMA_KEYSTORE` (la llave en base64) y `FIRMA_CLAVE` (su contraseña). Hay que conservar siempre la misma llave: si se cambia, Android no deja actualizar encima de la versión instalada. Para compilarlo a mano (con Android SDK y JDK 17):

```bash
FIRMA_ARCHIVO=/ruta/placas.keystore FIRMA_CLAVE=... ./gradlew assembleRelease
```

El APK queda en `app/build/outputs/apk/release/`.

## Autor

davidhc4
