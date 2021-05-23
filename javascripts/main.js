
/* ----- To-Do's View Component ----- */

function todosComponent(ctrl) {
  var models = concise.models
  var show_when = ctrl.show_when
  var filter = {
    'true': {
      'true': 'block',
      'false': 'none'
    },
    'false': {
      'true': 'none',
      'false': 'block'
    },
    'undefined': {
      'true': 'block',
      'false': 'block'
    }
  }

  // Create the view and attach all the view logic.
  return {
    'div#todo-component':{
      'h1 innerHTML="To-Do\'s"':0,

      // Include a partial.
      'div.nav': navComponent(),

      'div.list-container':{
        'div.list-editor':{
          'form':function(C$) {
            formLogic.call(this,C$)
            C$.dom = {
            'input.add-item-field type="text" name="new-item-field"': this.newItemInput,
            'input.new-item-submit type="submit" value="add"': 0
            }
          }
        },

        // Invoke the each() helper, calling the func on every item in `concise.models.list`.
        'ul#items-list each(list)': function(C$,id,item) {

          // Use fn.call() to share `this`, our context object.
          onEach.call(this,C$,id,item)
          var ul_parent = this

          C$.dom = { // Continue adding child nodes.
          'li': function(C$) {
            ul_parent.liChild(C$)
            C$.dom = {
            'input type="checkbox"': ul_parent.itemCheckbox,
            'button.delete-this innerHTML="&times;"': ul_parent.itemDelete,
            'input type="text"': ul_parent.itemInput
            }
          }
          }
        },
        'div.row.text-right': {
          "button#delete innerHTML='clear completed'": deleteButton
        }
      }
    }
  }


  function formLogic(C$) {
    var new_item_input = null

    C$.onSubmit(function(ev) {
      ev.preventDefault()
      models.list.push({ checked: false, text: new_item_input.value })
      new_item_input.value = ''
    })

    this.newItemInput = function(C$) {
      new_item_input = C$.el
    }
  }


  function deleteButton(C$) {
    C$.onClick(function() {
      function removeCompleted(item, idx) {
        if (item.checked) models.list.splice(models.list.indexOf(item), 1)
        else idx++

        if (idx < models.list.length) removeCompleted(models.list[idx], idx)
      }
      removeCompleted(models.list[0], 0)
    })
  }


  function onEach(C$, id, item) {

    this.liChild = function(C$) {
      C$.el.style.display = filter[show_when][item.checked]

      item.bind('checked', function() {
        C$.el.style.display = filter[show_when][item.checked]
      })
    }

    this.itemCheckbox = function(C$) {
      C$.el.checked = item.checked

      item.bind('checked', function(val) { C$.el.checked = item.checked })

      C$.onClick(function(ev) { item.checked = C$.el.checked })
    }

    this.itemDelete = function(C$) {
      C$.onClick(function() {
        if (confirm('Delete this item?')) models.list.splice( models.list.indexOf(item), 1 )
      })
    }

    this.itemInput = function(C$) {
      var wrap = item.fieldManager()

      C$.onInput(inputHandler)
      item.bind('text',outputHandler)

      function inputHandler(ev) {
        wrap.input(function() { item.text = C$.el.value })
      }
      function outputHandler(val) {
        wrap.output(function() { C$.el.value = val })
      }

      C$.el.value = item.text
    }
  }
}



/* ----- To-Do's View Changing Buttons ----- */

function navComponent() {
  return {
    'div.row':{
      'button innerHTML="All"':function(self) {
        self.onClick(function() { concise.controllers['todos-all']() })
      },
      'button innerHTML="Incomplete"':function(self) {
        self.onClick(function() { concise.controllers['todos-incomplete']() })
      },
      'button innerHTML="Completed"':function(self) {
        self.onClick(function() { concise.controllers['todos-completed']() })
      },
    }
  }
}



/* ----- Main ----- */

;(function() {
  concise.viewParent = document.querySelector('#concise-app')

  new concise.Model('list', [
    { "checked": false, "text": "buy almond milk" },
    { "checked": false, "text": "schedule dentist appointment" },
    { "checked": true,  "text": "end world hunger" },
    { "checked": false, "text": "go to swimming lessons" },
    { "checked": true,  "text": "get my haircut" },
  ])


  /*
  Controllers
  The router runs the ctrl function upon route change.
  */

  var todosAll = new concise.Controller('todos-all', function() {
    this.show_when = undefined
    this.view = todosComponent
  })

  new concise.Controller('todos-completed', function() {
    this.show_when = true
    this.view = todosComponent
  })

  new concise.Controller('todos-incomplete', function() {
    this.show_when = false
    this.view = todosComponent
  })

  todosAll()
})()
