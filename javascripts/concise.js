(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/*
The MIT License (MIT)

Copyright (c) 2014 Rob Christian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*

Semi-colon line terminators are just FUD. If your minifier can't handle this code, switch to one that is JS-compliant.
http://blog.izs.me/post/2353458699/an-open-letter-to-javascript-leaders-regarding
http://inimino.org/~inimino/blog/javascript_semicolons

The only time you EVER need a semi-colon for statement termination:
;[1,2,3].map(function(val){ 'do stuff' })
;(function(){ 'do stuff' })

*/



;(function(){

	var global = typeof global !== 'undefined' ? global : window

	global.familyOf = require('typeof').familyOf
	global.typeOf = require('typeof').typeOf

	// var Extensions = null
	var connected = require('connected')
	var Bindable = connected.Bindable

	var concise = new Concise()
	var DEFINE = Object.defineProperty
	var _current_modifiers_
	var MicroEvent = require('microevent')
	var _controller_events = new MicroEvent()

	var runway = require('runway/runway-browser.js')
	Object.keys(runway).map(function(prop){
		concise[prop] = runway[prop]
	})


	/**
	 *
	 * Concise Classes
	 *
	 */

	function Concise(){
		this.controllers = {}
		this.activeController = null
	}

	// Concise.prototype.useExtension = function(obj){
	// 	if (typeOf(obj) !== 'Function')
	// 		throw new Error('Concise.useExtension() called but expects a constructor function only.')
	// 	else
	// 		Extensions = obj
	// }

	Concise.prototype.setView = function(ctrl){
		var self = this

		if (self.activeController !== ctrl) {

			if (self.activeController) self.activeController.builder.el = vacateNode( concise.viewParent )

			self.activeController = ctrl
			if (concise.viewParent && /^HTML.*Element/.test(typeOf(concise.viewParent))) {
				concise.viewParent.insertBefore(ctrl.builder.el, concise.viewParent.firstChild)
			}
		}
	}

	Concise.prototype.get = function(path, cb){
		var xhr = global.XMLHttpRequest || ActiveXObject
		var request = new xhr('MSXML2.XMLHTTP.3.0')

		request.onload = function(){

			if (request.status >= 200 && request.status < 400) {

				try { cb( JSON.parse(request.responseText) ) }
				catch (e) { console.log(e) }

			}
			else console.log('failed')

		}

		request.open('GET', path, 1)
		request.send()
	}

	Concise.prototype.inject = function(href) {
		var js = document.createElement('script')
		js.src = href
		document.body.appendChild(js)
	}

	Concise.prototype.Controller = require('./internal/concise.controller.js')(concise, DEFINE, _controller_events, DomBuilder)

	Concise.prototype.Model = require('./internal/concise.model.js')(concise, Bindable)

	Concise.prototype.models = new Bindable({})

	Concise.prototype.helpers = require('./internal/concise.helpers.js')

	Concise.prototype.Region = function Region(partials){
		this.area = document.createElement('div')

		this.changeTo = function(num){
			var C$ = partials[num]
			if (C$ && typeOf(C$) === 'DomBuilder') {
				if (this.area.firstChild) this.area.removeChild(this.area.firstChild)
				this.area.appendChild(C$.el.cloneNode(true))
			}
		}

		// Partials is an array of view objects.
		partials.map(function(obj,i){
			if (typeOf(obj) !== 'Object') throw new Error('Region received invalid view object. Expected plain JS object.')
			partials[i] = new DomBuilder(null, null, obj)
		})
	}



	function DomBuilder(parent, el, value){
		this.parent = parent || {}
		this.el = el || null
		this.validates = false
		if (value) {
			if (typeOf(value) === 'Object') this.dom = value
			else if (typeOf(value) === 'Function') value(this)
		}
	}

	DEFINE(DomBuilder.prototype, 'dom', {enumerable:false, configurable:false,
		set:buildDom
	})
	function buildDom(structure){
		if (! familyOf(this.el)) throw new Error('Missing valid view element. Cannot build a DOM before doing `$.view = document.querySelector(<your_selector>)`.')
		if (typeOf(structure) !== 'Object') throw new Error('Invalid dom structure object.')

		if (! this.el) console.log('No element above current element')

		// For every property, do recursive build.
		for (var el_str in structure) {
			if (structure.hasOwnProperty(el_str)) buildRecursively.call(this, el_str, structure)
		}
	}

	function buildRecursively(key, structure){
		var parsed
		var val
		var el

		if (! elDefinitionValidate(key)) return

		parsed = parseElementString(key)
		this.validates = parsed.validate
		el = parsed.el

		val = structure[key]
		if (! val) {
			this.el.appendChild(el)
			return
		}
		if (parsed.helpers && parsed.helpers.length) {
			execHelpers.call(this, parsed, el, val)
		}
		else {
			(typeOf(val) === 'String') ? el.innerHTML = val : builder = new DomBuilder(this, el, val)
		}

		this.el.appendChild(el)
		if (this.parent && this.parent.validates && this.el.tagName === 'FORM') this.formValidate()
	}

	function execHelpers(parsed, el, val){
		var data
		var expected_model
		var helper_str
		var helper_fn
		var builder
		// var ext = Extensions ? new Extensions() : {}

		parsed.helpers.map(function(helper_str){
			var _parent, _prop
			if (typeOf(val) !== 'Function') throw new Error('DOM object "'+key+'" defined with helper method but has no function upon which to apply it.')

			helper_fn = concise.helpers[ helper_str.split('(')[0] ]

			expected_model = /\((.+)\)/g.exec(helper_str)[1]

			data = expected_model.split('.').reduce(function(object, prop){
				_parent = object
				_prop = prop
				return object[prop]
			}, concise.models)

			if (! data)
				console.info('Alert! Expected model "'+expected_model+'" not available for each() templating helper')

			builder = new DomBuilder(this, el)
			this.el.appendChild(el)
			helper_fn(builder,_parent,_prop,val)
			// helper_fn.call(ext,builder,_parent,_prop,val)

		}.bind(this))
	}

	DEFINE(DomBuilder.prototype, 'model', {enumerable:false, configurable:false, set:function(){},
		get:function(){ return this._model || this.parent.model }
	})

	DomBuilder.prototype.onFocus = function(cb){
		this.el.addEventListener('focus',cb)
	}

	DomBuilder.prototype.onBlur = function(cb){
		this.el.addEventListener('blur',cb)
	}

	DomBuilder.prototype.onSubmit = function(cb){
		this.el.addEventListener('submit',cb)
	}

	DomBuilder.prototype.onClick = function(cb){
		this.el.addEventListener('click',cb)
	}

	DomBuilder.prototype.onInput = function(cb){
		this.el.addEventListener('input',cb)
	}

	DomBuilder.prototype.setValid = function(bool, string){
		this.el.setCustomValidity( bool ? '' : string )
	}

	DomBuilder.prototype.formValidate = function(){
		console.log( 'FORM VALIDATE', this )

		this._model = new Bindable({})
		var model = this._model
		var done_for = ['input','textarea']
		model._new_property_ = ['_valid_', false]


		var child = this.el.firstChild
		while (child) {
			if (done_for.indexOf(child.tagName.toLowerCase()) != -1 && child.name) {
				model._new_property_ = [child.name, '']
				// child.addEventListener('input',listener.bind(child))
				Bindable.bindField(child, model)
			}
			child = child.nextSibling
		}

		function listener(){ model[this.name] = this.value }
	}



	/* Takes a CSS selector-style string and generates corresponding real DOM element. */

	var _reg = ''
	_reg += "(\\w+[\\w-]*(?:\\.\\w+)*=['].*?['])(?=\\s[\\w\\d.]+(?:[=(]|$))" + '|'
	_reg += '(\\w+[\\w-]*(?:\\.\\w+)*=["].*?["])(?=\\s[\\w\\d.]+(?:[=(]|$))' + '|'
	_reg += "(\\w+[\\w-]*(?:\\.\\w+)*=['].*?['])$" + '|'
	_reg += '(\\w+[\\w-]*(?:\\.\\w+)*=["].*?["])$' + '|'
	_reg += '(\\w+[\\w-]*[(]\\w(?:[\\w\\d]+|[\\w\\d.][^.])*[)])$' + '|'
	_reg += '([\\w\\d-]+)'
	_reg = new RegExp(_reg,'g')
	// var _reg = /(\w+[\w-]*(?:\.\w+)*=['].*?['])(?=\s[\w\d.]+(?:[=(]|$))|(\w+[\w-]*(?:\.\w+)*=["].*?["])(?=\s[\w\d.]+(?:[=(]|$))|(\w+[\w-]*(?:\.\w+)*=['].*?['])$|(\w+[\w-]*(?:\.\w+)*=["].*?["])$|(\w+[\w-]*[(]\w(?:[\w\d]+|[\w\d.][^.])*[)])$|([\w\d-]+)/g

	function parseElementString(desc){
		var el=null, parts, tag_id_classes, props_helpers, tag='', id='', classes=[], matches=true, properties=[], tokens, validate=false, helpers=[]
		var keywords = ['validate']

		if (/^[^\w]/g.test(desc)) throw new Error("Descriptor doesn't begin with a tag name: "+desc)

		// Split at the very first space character.
		parts = /^([^\s]+)(?:\s(.*))?$/g.exec(desc)
		tag_id_classes = parts[1]
		if (tag_id_classes && /#/g.test(tag_id_classes) && tag_id_classes.match(/#/g).length > 1) throw new Error('HTML descriptor cannot contain multiple ids: '+tag_id_classes)


		tag_id_classes = tag_id_classes.match(/[#.]?\w[\w\d-]*/g)
		tag = tag_id_classes[0]
		tag_id_classes.map(function(string){
			switch (string[0]) {
				case ('#'):
					id = string.slice(1)
					break
				case ('.'):
					classes[classes.length] = string.slice(1)
					break
			}
		})


		el = document.createElement(tag)
		if (classes.length)
			el.className = classes.join(' ')
		if (id)
			el.id = id


		// Handling property values and helper referrences.

		if (parts[2]) {
			props_helpers = parts[2]

			tokens = props_helpers.match(_reg)
			if (/\w+\(.*\)$/g.test(props_helpers) && /\w+\((?:[^\w].*|.*[^\w])\)$/g.test(props_helpers))
				throw new Error('Invalid helper definition: '+props_helpers)

			validate = tokens.indexOf('validate') !== -1

			tokens.map(function(string, id){
				switch (true) {

					case (/^[\w\d][\w\d-]*$/.test(string)):
						matches = /^[\w\d][\w\d-]*$/.exec(string)
						if (keywords.indexOf(matches[0]) === -1) properties[properties.length] = [matches[0], true]
						break

					case (/^(\w[\w\d-.]*)=["'](.*)["']$/.test(string)):
						var property_path
						matches = /^([\w\d-.]+)=["']((?:\"|\'|[^'"])*)["']$/.exec(string)
						property_path = matches[1].split('.')
						property_path[property_path.length] = matches[2]
						properties[properties.length] = property_path
						break

					case (/^\w[\w\d]+\([^)]+\)$/.test(string)):
						if (! helpers) helpers = []
						helpers[helpers.length] = string
						break

					default: throw new Error('Invalid token in HTML descriptor: '+string)
				}
			})


			// A property path is an array where each subsequent item is the value of the previous property on the parent.
			// This allows us to set nested properties defined as a string, like "style.display='block'".
			properties.forEach(function(prop_path){

				prop_path.reduce(function(parent, child){ //if (logit) console.log(parent, child)
					if (prop_path.indexOf(child) === prop_path.length-2) {
						parent[child] = prop_path.pop()
					} else {
						return parent[child]
					}
				}, el)

			})
		}

		return { el:el, validate:validate, helpers:helpers }
	}


	function elDefinitionValidate(el_str){ return true
		if (/\s/g.test(el_str) && el_str.match(/\s/g).length > 1) {
			throw new Error('Invalid DOM object definition. Cannot have more than one space character.')
			return false
		}
		else return true
	}

	function vacateNode(el){
		var frag = new DocumentFragment()

		// This removes a.firstChild from wherever it is and into a doc frag.
		while (el.firstChild) frag.appendChild(el.firstChild)

		return frag
	}

	module.exports = global.concise = concise
})()

},{"./internal/concise.controller.js":2,"./internal/concise.helpers.js":4,"./internal/concise.model.js":5,"connected":7,"microevent":6,"runway/runway-browser.js":10,"typeof":12}],2:[function(require,module,exports){

module.exports = function(concise, DEFINE, _ctrl_events, DomBuilder){

	function Controller(name, constructor){
		var self = this
		console.info('new controller:', name, self)

		self._id = name || Math.random().toString().split('.')[1]

		self.builder = new DomBuilder(null)
		self.builder.el = new DocumentFragment()

		constructor.call(self)

		concise.controllers[name] = function(){
			_ctrl_events.trigger(self._id)
			concise.setView(self)
		}

		return concise.controllers[name]
	}
	Controller.prototype.onActive = function(fn){
		_ctrl_events.bind(this._id, fn)
	}
	DEFINE(Controller.prototype, 'view', {enumerable:false, configurable:false,
		set:function(view){
			this.builder.dom = typeOf(view) === 'Function' ? view(this) : view
		}
	})
	DEFINE(Controller.prototype, 'models', {enumerable:false, configurable:false,
		get:function(){ return concise.models }
	})

	return Controller
}

},{}],3:[function(require,module,exports){

module.exports = function each(C$, parent, child, constructor){
	var self = this

	parent.bind(child, function(keyval, type){
		// Further optimizations are likely to come.
		// if (type === 'push') {
		//   constructor.call(o.el, o, keyval[0], keyval[1])
		// }
		// else if (type === 'pop') {
		//   o.el.lastChild.outerHTML = ''
		// }
		while (C$.el.firstChild) C$.el.removeChild(C$.el.firstChild)
		buildDom()
	})

	if (! parent[child]) return


	function buildDom(){
		Object.keys(parent[child]).map(function(index){

			self.bind = function(prop){
				return function(C$){
					C$.value = parent[child][index][prop]
					parent[child][index].bind(prop, function(val){ C$.value = val })
				}
			}

			if (typeOf(constructor) === 'Function')
				constructor.call(self, C$, index, parent[child][index])

			else if (typeOf(constructor) === 'Object')
				C$.dom = constructor

		})
	}
	buildDom()
}


// module.exports = function each(C$, parent, prop, constructor){
// 	var context = this

// 	if (! parent[prop]) {
// 		return
// 		// throw new Error('Helper received invalid data object with constructor: '+constructor.toString())
// 	}

// 	parent.bind(prop, function(keyval, type){
// 		// Further optimizations are likely to come.
// 		// if (type === 'push') {
// 		//   constructor.call(o.el, o, keyval[0], keyval[1])
// 		// }
// 		// else if (type === 'pop') {
// 		//   o.el.lastChild.outerHTML = ''
// 		// }
// 		C$.el.innerHTML = ''
// 		buildDom()
// 	})


// 	function buildDom(){
// 		Object.keys(parent[prop]).map(function(key){

// 			if (typeOf(constructor) === 'Function')
// 				constructor.call(context, C$, key, parent[prop][key])

// 			else if (typeOf(constructor) === 'Object')
// 				C$.dom = constructor

// 		})
// 	}
// 	buildDom()
// }

},{}],4:[function(require,module,exports){

module.exports = {
	each: require('./concise.helpers.each.js')
}

},{"./concise.helpers.each.js":3}],5:[function(require,module,exports){

module.exports = function(concise, Bindable){

	return function Model(name, obj) {
		if (typeOf(obj) === 'Object' || typeOf(obj) === 'Array') {
			concise.models._new_property_ = [name, new Bindable(obj)]
			return concise.models[name]
		}
	}
}

},{}],6:[function(require,module,exports){
/**
 * MicroEvent - to make any js object an event emitter (server or browser)
 *
 * - pure javascript - server compatible, browser compatible
 * - dont rely on the browser doms
 * - super simple - you get it immediatly, no mistery, no magic involved
 *
 * - create a MicroEventDebug with goodies to debug
 *   - make it safer to use
*/

var MicroEvent	= function(){}
MicroEvent.prototype	= {
	bind	: function(event, fct){
		this._events = this._events || {};
		this._events[event] = this._events[event]	|| [];
		this._events[event].push(fct);
	},
	unbind	: function(event, fct){
		this._events = this._events || {};
		if( event in this._events === false  )	return;
		this._events[event].splice(this._events[event].indexOf(fct), 1);
	},
	trigger	: function(event /* , args... */){
		this._events = this._events || {};
		if( event in this._events === false  )	return;
		for(var i = 0; i < this._events[event].length; i++){
			this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1))
		}
	}
};

/**
 * mixin will delegate all MicroEvent.js function in the destination object
 *
 * - require('MicroEvent').mixin(Foobar) will make Foobar able to use MicroEvent
 *
 * @param {Object} the object which will support MicroEvent
*/
MicroEvent.mixin	= function(destObject){
	var props	= ['bind', 'unbind', 'trigger'];
	for(var i = 0; i < props.length; i ++){
		destObject.prototype[props[i]]	= MicroEvent.prototype[props[i]];
	}
}

// export in common js
if( typeof module !== "undefined" && ('exports' in module)){
	module.exports	= MicroEvent
}

},{}],7:[function(require,module,exports){

/*
The MIT License (MIT)

Copyright (c) 2014 Rob Christian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/



/*

Semi-colon line terminators are just FUD. If your minifier can't handle this code, switch to one that is JS-compliant.
http://blog.izs.me/post/2353458699/an-open-letter-to-javascript-leaders-regarding
http://inimino.org/~inimino/blog/javascript_semicolons

The only time you EVER need a semi-colon for statement termination:
;[1,2,3].map(function(val){ 'do stuff' })
;(function(){ 'do stuff' })

*/


;(function(){

	var familyOf = require('typeof').familyOf
	var typeOf = require('typeof').typeOf
	var MicroEvent = require('microevent')



	/*  Private Class Data  */

	var DEFINE = Object.defineProperty
	var OVERRIDE = function(object, method_name, method){
		DEFINE(object, method_name, { enumerable:false, configurable:false, value:method })
	}
	var _property_manipulator_
	var PROPERTY_MANIPULATOR = function(obj){
		if (! obj) return _property_manipulator_
		else _property_manipulator_ = obj
		return PROPERTY_MANIPULATOR
	}

	var _bindables = []
	var _events = new MicroEvent()



	/*  Bindable Classes  */

	function Bindable(data){
		if (typeOf(data) === 'Array')
			return new BindableArray(data)
		else if (familyOf(data) === 'complex')
			return new BindableObject(data)
	}

	function BindableObject(data){
		Object.keys(data).map(function(prop){
			this._new_property_ = [prop, data[prop]]
		}.bind(this))
	}
	DEFINE(BindableObject.prototype, 'bind', { enumerable:false, configurable:false, value:bind })
	DEFINE(BindableObject.prototype, 'unbind', { enumerable:false, configurable:false, value:unbind })
	DEFINE(BindableObject.prototype, 'trigger', { enumerable:false, configurable:false, value:trigger })
	DEFINE(BindableObject.prototype, 'recompute', { enumerable:false, configurable:false, value:recompute })
	DEFINE(BindableObject.prototype, 'fieldManager', { enumerable:false, configurable:false, value:fieldManager })
	DEFINE(BindableObject.prototype, 'onChange', { enumerable:false, configurable:false,
		value:function(props, cb){
			var self = this
			if (typeOf(props) !== 'Array') return
			props.forEach(function(prop){ self.bind(prop,cb) })
		}
	})
	DEFINE(BindableObject.prototype, '_new_property_', { enumerable:false, configurable:false,
		set:function(pair){ addProperty.call(this, pair) }
	})


	function BindableArray(array){
		var self = []

		var _id
		DEFINE(self, '_timeout', { enumerable:false, configurable:false, value:60 })
		DEFINE(self, 'bind', { enumerable:false, configurable:false, value:bind })
		DEFINE(self, 'unbind', { enumerable:false, configurable:false, value:unbind })
		DEFINE(self, 'trigger', { enumerable:false, configurable:false, value:trigger })
		DEFINE(self, 'recompute', { enumerable:false, configurable:false, value:recompute })
		DEFINE(self, 'fieldManager', { enumerable:false, configurable:false, value:fieldManager })
		DEFINE(self, 'accept_id', { enumerable:false, configurable:false,
			value:function(id){
				if (id === PROPERTY_MANIPULATOR) _id = id().id
			}
		})
		DEFINE(self, '_new_property_', { enumerable:false, configurable:false,
			set:function(pair){ addProperty.call(self, pair) }
		})
		OVERRIDE(self, 'push', function(obj){

			self._new_property_ = [self.length, obj]
			debounce(self._timeout, 'push'+_id, function(){
				_events.trigger(_id, [self.length-1, self[self.length-1]], 'push')
				console.log( 'emit: push'+_id )
			})

		})
		OVERRIDE(self, 'pop', function(){

			var r = self[self.length-1]
			self.length = self.length-1
			debounce(self._timeout, 'pop'+_id, function(){
				_events.trigger(_id, r, 'pop')
				console.log( 'emit: pop'+_id )
			})
			return r

		})
		OVERRIDE(self, 'shift', function(){

			var r = self[0]
			Object.keys(self).map(function(idx){
				self[+idx] = self[+idx+1]
				self[+idx] = PROPERTY_MANIPULATOR({
					fetch:function(id){ self[+idx] = PROPERTY_MANIPULATOR({id:id}) }
				})
			})
			self.length = self.length-1
			debounce(self._timeout, 'shift'+_id, function(){
				_events.trigger(_id, r, 'shift')
				console.log( 'emit: shift'+_id )
			})
			return r

		})
		OVERRIDE(self, 'unshift', function(obj){

			Object.keys(self).reverse().map(function(idx){
				console.log(+idx+1, +idx)
				self._new_property_ = [+idx+1, self[+idx]]
				self[+idx] = PROPERTY_MANIPULATOR({
					fetch:function(id){ self[+idx+1] = PROPERTY_MANIPULATOR({id:id}) }
				})
			})
			self._new_property_ = [0, obj]
			debounce(self._timeout, 'unshift'+_id, function(){
				_events.trigger(_id, self, 'unshift')
				console.log( 'emit: unshift'+_id )
			})
			return self.length

		})
		OVERRIDE(self, 'splice', function(){

			debounce(self._timeout, 'splice'+_id, function(){
				_events.trigger(_id, self, 'splice')
				console.log( 'emit: splice'+_id )
			})
			Array.prototype.splice.apply(self, arguments)

		})
		OVERRIDE(self, 'slice', function(){

			Array.prototype.slice.apply(self, arguments)
			debounce(self._timeout, 'slice'+_id, function(){
				_events.trigger(_id, self, 'slice')
				console.log( 'emit: slice'+_id )
			})

		})
		OVERRIDE(self, 'reverse', function(idx1, idx2){ // This works, but it's not optimized yet.

			for (var l=0; l < Math.floor(self.length/2); l++) {
				// Method 1 is this.
				var r = self.length-1 - l
				swapIds.call(self,l,r)
				// Method 2 would be something like this.
				// Array.prototype.push.call(self, self[ length ])
				// Array.prototype.splice.call(self, length, 1)
			}
			Array.prototype.reverse.call(self)
			debounce(self._timeout, 'reverse'+_id, function(){
				_events.trigger(_id, self, 'reverse')
				console.log( 'emit: reverse'+_id )
			})
			return self

		})
		OVERRIDE(self, 'concat', function(arr){
			self.trigger(PROPERTY_MANIPULATOR({id:_id}))

			// This method is not implemented according to the standard, as it modifies the object it's being called upon.
			// In the future we'll aim to fix this, making it conform to the standard.

			if (typeOf(arr) === 'Array' && arr.length) {
				Object.keys(arr).map(function(key){
					self._new_property_ = [self.length, arr[key]]
				})
			}
			debounce(self._timeout, 'concat'+_id, function(){
				_events.trigger(_id, self, 'concat')
				console.log( 'emit: concat'+_id )
			})

			return self

		})

		Object.keys(array).map(function(idx){
			self._new_property_ = [+idx, array[+idx]]
		})

		return self

	}

	function swapIds(l,r){
		this[r] = PROPERTY_MANIPULATOR({ fetch:function(r_id){
			this[l] = PROPERTY_MANIPULATOR({ fetch:function(l_id){
				this[r] = PROPERTY_MANIPULATOR({id:l_id})
				this[l] = PROPERTY_MANIPULATOR({id:r_id})
			}})
		}})
	}


	/*  Class Methods  */

	function addProperty(pair){
		var _val, _id, _prop, val, parent = this
		_id = +Math.random().toString().split('.')[1]

		if (typeOf(pair) === 'Array') {
			_prop = pair[0]
			val = pair[1]
		} else {
			console.log('Abort! Bad property assignment:',pair)
			console.trace()
			return
		}
		parent.trigger('_id', '_new_property_:'+_prop)

		DEFINE(this, _prop, {
			enumerable: true,
			configurable: true,
			get: function(){ return _val },
			set: function(value){
				if (value === PROPERTY_MANIPULATOR && PROPERTY_MANIPULATOR().fetch) {
					PROPERTY_MANIPULATOR().fetch(_id)
				}
				// else if (value === PROPERTY_MANIPULATOR && PROPERTY_MANIPULATOR().updated) {
				//   // if (typeOf(_val) === 'complex') _val = PROPERTY_MANIPULATOR({updated:true})
				//   // else _events.trigger(_id, _val)
				// }
				else if (value === PROPERTY_MANIPULATOR && PROPERTY_MANIPULATOR().id) {
					_id = PROPERTY_MANIPULATOR().id
				}
				else if (familyOf(value) === 'complex') {
					_val = new Bindable(value)
					if (typeOf(value) === 'Array') _val.accept_id(PROPERTY_MANIPULATOR({id:_id}))
					_events.trigger(_id, _val)
				}
				else {
					_val = value
					_events.trigger(_id, _val)
				}
			}
		})
		this[_prop] = val
		if (typeOf(val) === 'Array') this[_prop].accept_id( PROPERTY_MANIPULATOR({id:_id}) )
	}

	function trigger(event){
		var _id
		if (event === PROPERTY_MANIPULATOR) _id = PROPERTY_MANIPULATOR().id
		if (event && event === '_id') _events.trigger(_id)
	}

	function bind(property, setter_cb){
		var self = this
		// console.log('WHAT PROPERTY?',property)
		self[property] = PROPERTY_MANIPULATOR({
			fetch:function(id){ /*console.log('WHICH ID?',id);*/ _events.bind(id,setter_cb) }
		})
	}

	function unbind(setter_cb){
		_events.unbind(setter_cb)
	}

	function recompute(data){
		if (familyOf(data) === 'complex')
			this.constructor.apply(this,data)
		return this
	}



	/* Takes a form DOM object and a Binding object, and does the rest for you. */

	function bindForm(form, bindable){

		;[].forEach.call(form.querySelectorAll('input'), function(field){

			bindField(field, bindable)

		})

	}

	function bindField(field, bindable){

		if (field.name in bindable) {

			var wrap = fieldManager()

			field.addEventListener('input', function(ev){
				var do_it = function(){ bindable[field.name] = ev.target.value }
				wrap.input( do_it )
			})

			bindable.bind(field.name, function(val){
				var do_it = function(){ field.value = val }
				wrap.output( do_it )
			})

			field.value = bindable[field.name]
		}

	}



	/* Inverts control: Prevents inputs from receiving updates while they are the sender. */

	function fieldManager(){
		var _sent_by_me = false

		return {
			"input": function inputManager(do_it){
				_sent_by_me = true
				do_it()
			},
			"output": function outputManager(do_it){
				_sent_by_me ? _sent_by_me = false : do_it()
			}
		}
	}



	/* Our entry point for creating bindable objects, keeps a reference to the object created. */

	function NewBindable(data){
		var bindable = new Bindable(data)
		_bindables.push(bindable)
		return bindable
	}



	/*  HELPERS  */

	var debounce
	;(function(){
		var bounced = {}
		debounce = function(t, id, cb){
			clearTimeout( bounced[id] )
			bounced[id] = setTimeout(cb, t)
		}
	})()



	NewBindable.fieldManager = fieldManager
	NewBindable.bindField = bindField
	NewBindable.bindForm = bindForm
	NewBindable.unbind = unbind
	NewBindable.bind = bind

	DEFINE(NewBindable, 'bindables', {get:function(){return _bindables}, enumerable:true})
	DEFINE(NewBindable, 'PROPERTY_MANIPULATOR', {value:PROPERTY_MANIPULATOR, writeable:false})


	if (typeof module !== 'undefined' && module.hasOwnProperty('exports')) {
		var object = {
		// , Bindable: Bindable
			Bindable: NewBindable
		, familyOf: familyOf
		, typeOf: typeOf
		, unbind: unbind
		, bind: bind
		}
		module.exports = object
	} else {
		// window.Bindable   = Bindable
		window.Connected  = NewBindable
		window.familyOf   = familyOf
		window.typeOf     = typeOf
	}

})();

},{"microevent":8,"typeof":12}],8:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6}],9:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6}],10:[function(require,module,exports){

/*

Semi-colon line terminators are just FUD. If your minifier can't handle this code, switch to one that is JS-compliant.
http://blog.izs.me/post/2353458699/an-open-letter-to-javascript-leaders-regarding
http://inimino.org/~inimino/blog/javascript_semicolons

The only time you EVER need a semi-colon for statement termination:
;[1,2,3].map(function(val){ 'do stuff' })
;(function(){ 'do stuff' })

*/

var runway = require('./runway.js')
var active_controller
runway.bind('route added',function(){
	var ctrl = runway.go(location.pathname)
	if (ctrl && ctrl !== active_controller) {
		active_controller = ctrl
		active_controller()
	}
})

module.exports = runway



var onclick_els = ['A','BUTTON']

document.onclick = function(event) {
	event = event || window.event // IE specials
	var target = event.target || event.srcElement // IE specials

	// console.log('click happened:', target.dataset.href)
	if (onclick_els.indexOf(target.tagName) !== -1 && target.href) {
		event.preventDefault()
		processLink(target.href, target.dataset.ajax)
	}
}

function processLink(href, ajax){
	console.log('processLink', href)
	href = href.replace(location.origin,'')
	if (ajax !== 'none') {
		goForward(href)
		doRoute(href)
		return false
	}
	return true
}

function doRoute(href){
	active_controller = runway.go(href)
	if (active_controller) active_controller()
}

function goForward(url){
	if (history.pushState) history.pushState({url:url}, null, url)
	else location.assign(url)
}

window.onpopstate = function(event){ doRoute(event.state.url) }

function init(){
	history.replaceState( {url:location.pathname}, null, location.pathname )
}

window.addEventListener ? addEventListener('load', init, false) : window.attachEvent ? attachEvent('onload', init) : (onload = init)

},{"./runway.js":11}],11:[function(require,module,exports){

/*!
 * Runway Router
 * Copyright(c) 2015 Rob Christian
 * MIT Licensed
 */

var typeOf = require('typeof').typeOf

var routes_tree = Object.create(null)
var every_time
var logger
var countdown = 0
var intvl
var wildcards = {
	'{int}': '([1-9][0-9]*)',
	'{any}': '([^/]*)',
	'{a-z}': '([a-zA-Z]+)',
	'{num}': '([0-9]+)'
}


function Runway(args){
	this.routes = router
	this.go = pathMatcher
	this.listener = reqListener
}
require('microevent').mixin(Runway)
var runway = module.exports = new Runway()



/**
 * Calling this function adds a new route.
 */
function router(arg1, f, c){

	var $, url, nested

	if (typeOf(arg1) === 'Array' && arg1.length && !f) {

		arg1.map(function(r){ router.apply(null,r) })

		return
	}

	if (typeof arg1 !== 'string')
		throw new Error('Router accepts only a string as the first argument.')
	url = arg1

	c = arguments[arguments.length-1]
	f = (Array.isArray(f)) ? f : []

	if (typeOf(c) !== 'Function') throw new Error('Controller either not specified or invalid.')
	f.forEach(function(e){
		if (typeOf(e) !== 'Function') throw new Error('Filter is not a function: '+{}.toString.apply(e))
	})

	$ = [].concat(f).concat(c)

	if (logger && typeOf(logger) === 'Function')
		logger('add route:', url, 'filters and controller:', $)
	// Convert route string into array of path segments.
	url = url.replace(/(^\/|\/$)/g,'').split('/')
	url[url.length] = '$'
	nested = newBranch(url, $)

	// Now include the new route in our routes map object.
	treeMerge(routes_tree, nested)
	runway.trigger('route added')

	return router
}


function reqListener(req, res){
	var ctrl = pathMatcher(req.url)
	if (ctrl) ctrl(req, res)
}


/**
 * Test a given URL. If it matches, return the leaf node from the routes_tree.
 */
function pathMatcher(url){
	// console.log('pathMatcher', url, routes_tree)
	if (! routes_tree) throw new Error('No routes defined.')

	var args = [], n = 0

	// Convert route into array of URL segments, ending with "$", the leaf node.
	var route = url.slice(1).replace(/\/$/g,'').split('?')[0].split('/')
	route[route.length] = '$'

	var result = route.reduce(treeClimber, routes_tree)
	var ctrl
	if (result && result[0]) {
		ctrl = function(req,res){ // leaf node from matching route, or undefined.
			result[0](req,res,args)
		}
	} else {
		ctrl = null
	}
	return ctrl


	// We define this internally so that args and n are within scope.
	// Climb the routes tree. Always check first for a matching static route segment before trying regex.
	function treeClimber(obj, seg){
		if (! obj) return null

		return obj[seg] || (function(){
			var regs = obj['<regex>'] || undefined
			if (regs) {
				for (var i=0; i < regs.patterns.length; i++) {
					if (regs.patterns[i].test(seg)) {
						args[n++] = seg // Increments n after the value is used for the assignment. More performant than .push().
						return regs[regs.patterns[i].toString()]
					}
				}
			}
		})()
	}

}




/**
 * Helpers
 */
// This converts an array representation of a complete route path, into a series of nested objects.
function newBranch(array, fn){
	return array.reverse().reduce(branchBuildingLogic, fn)
}

function branchBuildingLogic(cumulate, segment){
	var x = Object.create(null)

	if (! /^\{.+\}$/g.test(segment)) {
		x[segment] = cumulate
		return x
	}
	else {
		if (! wildcards[segment]) throw new Error('Unknown wildcard used in route: '+segment)

		var re = new RegExp(wildcards[segment])
		x['<regex>'] = { patterns: [re] }
		x['<regex>'][re.toString()] = cumulate
		return x
	}
}

// This merges a branch object (nested objects representing a route path) into our route tree object.
function treeMerge(to,from,fn){ //console.log(to,from,fn)
	Object.keys(from).map(function(prop){ //console.log('property:',prop)

		switch (true) {

			case prop === '<regex>':
				if (Object.hasOwnProperty.call(to,prop)) {
					from[prop].patterns.map(function(regex){
						if (hasMatchingRegex(to[prop].patterns, regex)) to[prop].patterns.push(regex)
					})
				}
				else to[prop] = from[prop]
				break

			case Object.hasOwnProperty.call(to,prop):
				treeMerge(to[prop],from[prop])
				break

			default:
				to[prop] = from[prop]

		}
		return
	})
}

function hasMatchingRegex(array,regex){
	return array.reduce(function(last,next){ return last || regexCompare(next,regex) }, false)
}

function regexCompare(a,b){
	return a.toString() === b.toString()
}


},{"microevent":9,"typeof":12}],12:[function(require,module,exports){

/*
 * This is where these helper functions will live for now. Development of ConciseJS will continue
 * to drive development of ConnectedJS, and these helpers.
 */

if (typeof HTMLElement === 'undefined'){
  var HTMLElement = function HTMLElement(){}
}

module.exports = (function(){

  function familyOf(thing){
    var type = typeOf(thing)
    if (type) {
      return ({
        Date: 'simple'
      , String: 'simple'
      , Number: 'simple'
      , Boolean: 'simple'
      , Function: 'simple'
      , RegExp: 'simple'
      , Array: 'complex'
      , Object: 'complex'
      , HTMLElement: 'complex'
      , 'undefined': 'falsey'
      , 'null': 'falsey'
      , 'NaN': 'falsey'
      })[type] || 'complex'
    } else {
      return false
    }
  }

  function typeOf(thing){
    if (typeof thing === 'number') return isNaN(thing) ? 'NaN' : 'Number'
    else if (thing instanceof HTMLElement) return 'HTMLElement'
    else return (thing !== null && thing !== undefined && thing.constructor) ? getObjectClass(thing) : '' + thing
  }

  function getObjectClass(obj) {
    var string
    if (obj.constructor && obj.constructor.toString) string = obj.constructor.toString()
    else throw new Error('Object constructor does not have toString method.')

    return (/function\s+(\w+)/.test(string)) ? string.match(/function\s+(\w+)/)[1] : 'Anonymous Class'
  }

  return {
    getObjectClass: getObjectClass
  , familyOf: familyOf
  , typeOf: typeOf
  }

})();

},{}]},{},[1]);
