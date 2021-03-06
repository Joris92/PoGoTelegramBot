// ===================
// add raid wizard
// ===================
const WizardScene = require('telegraf/scenes/wizard')
const moment = require('moment-timezone')
const {Markup} = require('telegraf')
var models = require('../models')
const Sequelize = require('sequelize')
const Op = Sequelize.Op
const inputTime = require('../util/inputTime')
const listRaids = require('../util/listRaids')

moment.tz.setDefault('Europe/Amsterdam')

function AddRaidWizard (bot) {
  return new WizardScene('add-raid-wizard',
    async (ctx) => {
      ctx.session.newraid = {}
      ctx.session.gymcandidates = []
      return ctx.answerCbQuery(null, undefined, true)
        .then(() => ctx.replyWithMarkdown(`Je wilt een nieuwe raid toevoegen. We gaan eerst de gym zoeken.\n*Voer een deel van de naam in, minimaal 2 tekens…*`))
        // .then(()=> {
      // .then(() => ctx.deleteMessage(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id))
      // ctx.session.prevMessage = {chatId: ,messageId:}
        // })
        .then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id))
        .then(() => ctx.wizard.next())
    },
    async (ctx) => {
      console.log('looking for raid', ctx.update)
      const term = ctx.update.message.text.trim()
      let btns = []
      if (term.length < 2) {
        return ctx.replyWithMarkdown(`Minimaal 2 tekens van de gymnaam…\n*Probeer het nog eens.* 🤨`)
          .then(() => ctx.wizard.back())
      } else {
        const candidates = await models.Gym.findAll({
          where: {
            gymname: {[Op.like]: '%' + term + '%'}
          }
        })
        if (candidates.length === 0) {
        // ToDo: check dit dan...
          ctx.replyWithMarkdown(`Ik kon geen gym vinden met '${term === '/start help_fromgroup' ? '' : term}' in de naam…\n*Probeer het nog eens*\nGebruik /cancel om te stoppen.`)
            .then(() => ctx.wizard.back())
        }
        ctx.session.gymcandidates = []
        for (let i = 0; i < candidates.length; i++) {
          ctx.session.gymcandidates.push({gymname: candidates[i].gymname, id: candidates[i].id})
          btns.push(Markup.callbackButton(candidates[i].gymname, i))
        }

        btns.push(Markup.callbackButton('Mijn gym staat er niet bij…', candidates.length))
        ctx.session.gymcandidates.push({name: 'none', id: 0})
        return ctx.replyWithMarkdown('Kies een gym.', Markup.inlineKeyboard(btns, {columns: 1}).removeKeyboard().extra())
          .then(() => ctx.wizard.next())
      }
    },
    async (ctx) => {
      if (!ctx.update.callback_query) {
        return ctx.replyWithMarkdown('Hier ging iets niet goed… \n*Je moet op een knop klikken 👆. Of */cancel* gebruiken om mij te resetten.*')
      }
      let selectedIndex = parseInt(ctx.update.callback_query.data)
      if (ctx.session.gymcandidates[selectedIndex].id === 0) {
        return ctx.answerCbQuery('', undefined, true)
          .then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id))
          .then(() => ctx.replyWithMarkdown('Jammer! \n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start'))
          .then(() => {
            ctx.session.gymcandidates = null
            ctx.session.newraid = null
            return ctx.scene.leave()
          })
      } else {
        // retrieve selected candidate from session
        let selectedgym = ctx.session.gymcandidates[selectedIndex]
        ctx.session.newraid.gymId = selectedgym.id
        ctx.session.newraid.gymname = selectedgym.gymname
        return ctx.answerCbQuery('', undefined, true)
          .then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id))
          .then(() => ctx.replyWithMarkdown(`*Hoe laat eindigt de raid?*\nGeef de tijd zo op: *09:30* of *13:45*…\n(Noot: eindtijd is uitkomen van het ei + 45 minuten)`))
          .then(() => ctx.wizard.next())
      }
    },
    async (ctx) => {
      // ToDo input check
      const endtimestr = ctx.update.message.text.trim()
      const endtime = inputTime(endtimestr)
      if (endtime === false) {
        return ctx.replyWithMarkdown('Dit is geen geldige tijd. Probeer het nog eens.')
          .then(() => ctx.wizard.back())
      }
      ctx.session.newraid.endtime = endtime
      let starttime = moment.unix(endtime)
      starttime.subtract(45, 'minutes')
      ctx.replyWithMarkdown(`*Welke starttijd stel je voor?*\nGeef de tijd tussen *${starttime.format('HH:mm')}* en *${moment.unix(endtime).format('HH:mm')}*`)
        .then(() => ctx.wizard.next())
    },
    async (ctx) => {
      let endtime = moment.unix(ctx.session.newraid.endtime)
      let starttime = moment.unix(ctx.session.newraid.endtime)
      starttime.subtract(45, 'minutes')
      const start1 = inputTime(ctx.update.message.text.trim())
      if (start1 === false) {
        return ctx.replyWithMarkdown(`Dit is geen geldige tijd. Geef de tijd tussen *${starttime.format('HH:mm')}* en *${moment(endtime).format('HH:mm')}*`)
          .then(() => ctx.wizard.back())
      }
      console.log('endtime', endtime, 'starttime', starttime, 'start1', start1)
      // Input check valid interval; starttime < start1 && endtime > start1
      if (starttime.diff(moment.unix(start1)) > 0 || endtime.diff(moment.unix(start1)) < 0) {
        return ctx.replyWithMarkdown(`De starttijd is niet geldig. Probeer het nog eens…`)
          .then(() => ctx.wizard.back())
      }
      ctx.session.newraid.start1 = start1
      ctx.replyWithMarkdown(`*Wat is de raid boss?*\nBijvoorbeeld *Kyogre* of *Level 5 ei*`)
        .then(() => ctx.wizard.next())
    },
    async (ctx) => {
      const target = ctx.update.message.text.trim()
      ctx.session.newraid.target = target

      // console.log(ctx.session.newraid)

      let out = `Tot ${moment.unix(ctx.session.newraid.endtime).format('HH:mm')}: *${ctx.session.newraid.target}*\n${ctx.session.newraid.gymname}\nStart: ${moment.unix(ctx.session.newraid.start1).format('HH:mm')}`

      return ctx.replyWithMarkdown(`${out}\n\n*Opslaan?*`, Markup.inlineKeyboard([
        Markup.callbackButton('Ja', 'yes'),
        Markup.callbackButton('Nee', 'no')
      ], {columns: 1}).removeKeyboard().extra())
        .then(() => ctx.wizard.next())
    },
    async (ctx) => {
      if (!ctx.update.callback_query) {
        ctx.replyWithMarkdown('Hier ging iets niet goed… *Klik op een knop 👆*')
      }
      const user = ctx.from
      let saveme = ctx.update.callback_query.data
      if (saveme === 'no') {
        return ctx.answerCbQuery('', undefined, true)
          .then(() => ctx.replyWithMarkdown('Jammer… \n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start'))
          .then(() => ctx.scene.leave())
      } else {
        // Sometimes a new raid is getting submitted multiple times
        // ToDo: adapt this when multiple starttimes are getting implemented
        var raidexists = await models.Raid.find({
          where: {
            [Op.and]: [
              {gymId: ctx.session.newraid.gymId},
              {target: ctx.session.newraid.target},
              {start1: ctx.session.newraid.start1},
              {endtime: ctx.session.newraid.endtime}
            ]
          }
        })
        if (raidexists) {
          console.log('New raid exists… Ignoring ' + ctx.session.newraid.gymId + ctx.session.newraid.target + ctx.session.newraid.endtime)
          return ctx.answerCbQuery(null, undefined, true)
            .then(() => {
              if (ctx.update.callback_query.message.message_id) {
                return ctx.deleteMessage(ctx.update.callback_query.message.message_id)
              }
            })
            .then(() => ctx.scene.leave())
        }
        let newraid = models.Raid.build({
          gymId: ctx.session.newraid.gymId,
          start1: ctx.session.newraid.start1,
          target: ctx.session.newraid.target,
          endtime: ctx.session.newraid.endtime,
          reporterName: user.first_name,
          reporterId: user.id
        })
        // console.log('TIME TEST: ',inputTime('17:15'))
        // console.log('ENDTIME', ctx.session.newraid.endtime)
        // console.log('START1', ctx.session.newraid.start1)
        // console.log('NEW RAID:', newraid)
        // console.log('TZ', process.env.TZ)
        // save...
        try {
          // console.log('save a raid by', user.first_name, user.id)
          await newraid.save()
        } catch (error) {
          console.log('Woops… registering new raid failed', error)
          return ctx.replyWithMarkdown(`Hier ging iets *niet* goed tijdens het saven… Misschien toch maar eens opnieuw proberen.`)
            .then(() => ctx.scene.leave())
        }
        // send updated list to group
        let out = await listRaids(`Raid toegevoegd door: [${user.first_name}](tg://user?id=${user.id})\n\n`)
        if (out === null) {
          return ctx.answerCbQuery(null, undefined, true)
            .then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id))
            .then(() => ctx.replyWithMarkdown(`Mmmm, vreemd. Sorry, geen raid te vinden.`))
            .then(() => ctx.scene.leave())
        }

        return ctx.answerCbQuery('', undefined, true)
          .then(async () => {
            bot.telegram.sendMessage(process.env.GROUP_ID, out, {parse_mode: 'Markdown', disable_web_page_preview: true})
          })
          .then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id))
          .then(() => ctx.replyWithMarkdown('Dankjewel!\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start'))
          .then(() => ctx.scene.leave())
      }
    }
  )
}
module.exports = AddRaidWizard
