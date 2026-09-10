# Entorno Stage en servidor

Este documento define una preproducción (stage) aislada para validar cambios antes de pasar a producción.

## Objetivo

- Código separado en `/opt/eduhoot-stage/src`.
- Proceso Node separado (`eduhoot-stage-server.service`).
- Puerto propio (`3100`).
- Host propio (`stage.tu-dominio`).
- Base de datos separada (`eduhoot_stage`).

## 1) Preparar servidor

```bash
sudo mkdir -p /opt/eduhoot-stage/src
sudo mkdir -p /etc/eduhoot
sudo mkdir -p /var/log/eduhoot-stage
sudo chown -R $USER:$USER /opt/eduhoot-stage
sudo chown -R root:adm /var/log/eduhoot-stage
sudo chmod 755 /var/log/eduhoot-stage
```

## 2) Variables de entorno de stage

```bash
sudo cp install-files/stage.env.example /etc/eduhoot/stage.env
sudo nano /etc/eduhoot/stage.env
sudo chmod 640 /etc/eduhoot/stage.env
```

Ajusta mínimo:
- `PORT=3100`
- `MONGO_URL=mongodb://127.0.0.1:27017/eduhoot_stage`
- `PUBLIC_BASE_URL=https://stage.tu-dominio`

## 3) Servicio systemd stage

```bash
sudo cp install-files/service/eduhoot-stage-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable eduhoot-stage-server
```

## 4) Nginx para stage

```bash
sudo cp install-files/nginx/eduhoot-stage.conf /etc/nginx/sites-available/eduhoot-stage.conf
sudo ln -sf /etc/nginx/sites-available/eduhoot-stage.conf /etc/nginx/sites-enabled/eduhoot-stage.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Desplegar a stage

```bash
cp scripts/deploy-stage.example.sh scripts/deploy-stage.sh
chmod +x scripts/deploy-stage.sh
```

Edita variables en `scripts/deploy-stage.sh` y ejecuta:

```bash
./scripts/deploy-stage.sh
```

Para probar sin copiar archivos:

```bash
DRY_RUN=1 ./scripts/deploy-stage.sh
```

## 6) Checklist de validación fiable

```bash
curl -I http://127.0.0.1:3100/
curl -I https://stage.tu-dominio/
sudo systemctl --no-pager --full status eduhoot-stage-server
sudo tail -n 120 /var/log/eduhoot-stage/server.log
```

Validaciones recomendadas por cambio:
- Login y recuperación de contraseña.
- Flujo host/player completo con 2 navegadores.
- Importación CSV y arranque de partida.
- Revisión visual rápida de landing/create/host/player.
- `npm run lint` antes de desplegar.

## 7) Promoción a producción

Promociona solo si stage está en verde:
- Lint OK.
- Auditoría de seguridad en nivel esperado.
- Flujos críticos validados.
- Sin errores recurrentes en logs.
