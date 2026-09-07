import Router from '../dist/index.js';
const router = new Router();
const route: Router.Route = (scope, location) => location.data.query.name;
router.routes['/hello'] = route;
router.navigate('/hello');
