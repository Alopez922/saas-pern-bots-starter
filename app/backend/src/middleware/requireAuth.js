import jwt from 'jsonwebtoken';
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'No auth' });
    const data = jwt.verify(token, process.env.SECRET_KEY);
    req.user = { id: data.id, email: data.email };
    next();
  } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }
}
