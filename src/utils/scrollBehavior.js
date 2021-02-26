export default function scrollBehavior (to, from, savedPosition) {
  if (savedPosition) {
    // savedPosition is only available for popstate navigations.
    return savedPosition
  } else {
    const position = { x: 0, y: 0 }

    return position
  }
}
