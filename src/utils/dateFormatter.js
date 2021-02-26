import dayjs from 'dayjs'

export default (date, format = 'DD MMMM YYYY, HH:mm') => {
  if (!date) return null
  return dayjs(date).format(format)
}