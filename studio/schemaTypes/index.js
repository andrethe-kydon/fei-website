import aboutPage from './aboutPage'
import careerProgramme from './careerProgramme'
import course from './course'
import figure from './figure'
import heroMedia from './heroMedia'
import homePage from './homePage'
import person from './person'
import siteSettings from './siteSettings'

// Objects first, then documents. figure and heroMedia are referenced by the
// documents below, and heroMedia references figure in turn.
export const schemaTypes = [figure, heroMedia, aboutPage, careerProgramme, course, homePage, person, siteSettings]
