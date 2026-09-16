import Router from '../dist/index.js';
const router = new Router();
const route: Router.Route = (scope, location) => location.data.query.name;
router.routes['/hello'] = route;
router.navigate('/hello');
router.navigationRoot = document.querySelector('main');
router.navigationRoot = document;
router.navigationRoot = null;

// @ts-expect-error route handlers must be functions or supported route objects.
router.routes['/invalid'] = 'invalid';
// @ts-expect-error route focus accepts a selector string or false.
const invalidFocus: Router.Route = {focus: 42};
// @ts-expect-error secure guards must be route handlers.
const invalidSecure: Router.Route = {secure: true};
// @ts-expect-error navigation URLs must be strings when provided.
router.navigate(42);
// @ts-expect-error navigation roots must be a Document, Element, or null.
router.navigationRoot = 'main';
void [invalidFocus, invalidSecure];
