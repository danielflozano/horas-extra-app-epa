const jwt = require('jsonwebtoken');


const generarJWT = (uid, name,rol, expiresIn = '2h') => {
  return new Promise((resolve, reject) => {
    const payload = { uid, name, rol};

    jwt.sign(payload, process.env.SECRET_JWT_SEED, { expiresIn }, (err, token) => {
      if (err) {
        console.log(err);
        reject('No se pudo generar el token');
      }
      resolve(token);
    });
  });
};

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ ok: false, msg: 'No hay refresh token' });
  }

  try {
    // Verificar refresh token
    const { uid, name, rol } = jwt.verify(refreshToken, process.env.REFRESH_JWT_SEED);

    // Generar nuevo access token
    const newAccessToken = await generarJWT(
      uid,
      name,
      rol,
      process.env.SECRET_JWT_SEED,
      '15m'
    );

    res.json({
      ok: true,
      token: newAccessToken
    });

  } catch (error) {
    console.log(error);
    res.status(401).json({ ok: false, msg: 'Refresh token inválido o expirado' });
  }
};


module.exports = {
  generarJWT,
  refreshToken
};

