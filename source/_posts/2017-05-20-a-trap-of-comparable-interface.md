---
layout:     post
title:      "Java Comparable 接口的一个小「坑」"
subtitle:   "关于 compareTo() 和 equals() 的一致性的思考"
author:     "刘文俊"
date:       2017-05-20
tags:
    - Java
---

`Comparable` 是 Java 中非常常用的一个接口，但是其中也有一些值得深究的细节。

我们以「德州扑克」游戏的业务场景为例进行说明。「德州扑克」是一款风靡世界的扑克游戏，要实现这个游戏，首先要对系统进行建模，我们可能会写出这样的一段代码：

	public enum PokerSuit {
	    SPADE, HEART, DIAMOND, CLUB
	}

	public class PokerCard {
	    private final int number;
	    private final PokerSuit suit;
	
	    public PokerCard(int number, PokerSuit suit) {
	        if (number < 1 || number > 13) {
	            throw new IllegalArgumentException("number");
	        }
	        this.number = number;
	        this.suit = Objects.requireNonNull(suit);
	    }
	
	    public int getNumber() {
	        return number;
	    }
	
	    public PokerSuit getSuit() {
	        return suit;
	    }
	}

`PokerCard` 是一个十分简单的模型类，但它足以描述游戏中的一张扑克牌。其中，number 表示扑克牌的点数，1 代表 A，11 ~ 13 代表 J ~ K；suit 表示扑克牌的花色，它是一个枚举类型；因为「德州扑克」中没有大王和小王，所以在这里不作考虑。

按照约定，如果我们需要把这个类用在基于哈希集合中，就必须覆写它的 `hashCode` 和 `equals` 方法。这个容易，覆写就是了：

	@Override
    public int hashCode() {
        return Objects.hash(number, suit);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof PokerCard)) return false;
        PokerCard other = (PokerCard) o;
        return this.number == other.number && this.suit == other.suit;
    }

另外，扑克牌之间需要比较大小，所以我们需要实现 `Comparable` 接口以支持比较操作。「德州扑克」比较牌的大小是单纯比较点数，忽略花色的，所以代码可能是这样：

	public class PokerCard implements Comparable<PokerCard> {
		// ...	

	    @Override
	    public int compareTo(PokerCard other) {
			// because 1(A) is bigger than any other number
	        int thisNum = this.number == 1 ? 14 : this.number;
	        int otherNum = other.number == 1 ? 14 : other.number;
	        return thisNum - otherNum;
	    }
	}

到此为止，一切都是那么和谐，在设计上，这个类似乎没有任何问题，事实上，在大部分情况下，它也是完全可以正常工作的。

那么，现在我们需要表示一个「牌型」的概念，所谓「牌型」，在德州扑克里面，即是在玩家的手牌与桌面的公共牌中选取五张牌所组成的一个集合，在比牌时，「牌型」最大的玩家即可赢得奖池。在这个定义中，我们可以知道，「牌型」是一个集合，而且需要支持比较操作，因此我们可以让它实现 `Set` 和 `Comparable` 接口。在实际操作中，我们一般不会直接实现 `Set` 接口，而是选择继承 `AbstractSet` 类以减少代码量，因此，代码可能是这样的：

	public class PokerCombination 
			extends AbstractSet<PokerCard> implements Comparable<PokerCombination> {
	    private final SortedSet<PokerCard> cards;
	
	    public PokerCombination(Collection<PokerCard> cards) {
	        if (cards == null || cards.size() != 5) { 
				throw new IllegalArgumentException("cards");
			}
	        this.cards = Collections.unmodifiableSortedSet(new TreeSet<>(cards));
	    }
	
	    @Override
	    public Iterator<PokerCard> iterator() {
	        return cards.iterator();
	    }
	
	    @Override
	    public int size() {
	        return cards.size();
	    }
	
	    @Override
	    public int compareTo(PokerCombination o) {
	        // compare the poker combinations
	        return 0;
	    }
	}

在这里，我们省略了 `compareTo` 方法的具体代码，但是，为了方便实现比较操作， 在`PokerCombination` 类的内部实现中，采用了 `SortedSet`，这是一个有序的集合，在其中的元素都会按照其自然顺序（即 `Comparable.compareTo` 方法定义的顺序）进行排序，`TreeSet` 是它的一个常见的实现类。 

现在我们添加一个测试方法，测试这个类的行为是否正确：

	@Test
    public void testSize() {
        Set<PokerCard> cards = new HashSet<>();
        cards.add(new PokerCard(1, PokerSuit.CLUB));
        cards.add(new PokerCard(1, PokerSuit.HEART));
        cards.add(new PokerCard(2, PokerSuit.CLUB));
        cards.add(new PokerCard(3, PokerSuit.CLUB));
        cards.add(new PokerCard(4, PokerSuit.CLUB));
        assertEquals(5, cards.size());

        PokerCombination combination = new PokerCombination(cards);
        assertEquals(5, combination.size());
    }

这个测试方法非常简单，它首先创建了一个集合，往里面添加了 5 张扑克牌，断言它的长度是 5，然后用这个集合构造了一个 `PokerCombination` 对象，再断言它的长度也是 5。就这样一个简单的测试，它几乎一定会运行成功，在很多人眼里，甚至都没有写这个它的必要。

然而，当你真的运行这个测试的时候，它却失败了<i class="emoji emoji-joy"></i>，错误信息如下：

	java.lang.AssertionError: 
	Expected :5
	Actual   :4

这是一个断言错误，发生在我们的第二次 `assertEquals` 调用时，我们期望 `PokerCombination` 的长度是 5，然而它却是 4。现在问题来了，为什么一个长度为 5 的集合，传入 `PokerCombination` 里面，却变成了 4 呢？这里面发生的事情，仅仅是将传入的集合复制到一个 `SortedSet` 里面而已。

我们尝试将 `SortedSet` 换成更为通用的 `Set`，将 `TreeSet` 换成 `HashSet`，发现测试能正常执行，但是换回 `SortedSet` 的时候，它又失败了，因此，问题一定与 `SortedSet` 有关。打开它的源码，查看 JavaDoc，我们看到了下面这段描述：

> <p>Note that the ordering maintained by a sorted set (whether or not an explicit comparator is provided) must be <i>consistent with equals</i> if the sorted set is to correctly implement the <tt>Set</tt> interface.  (See the <tt>Comparable</tt> interface or <tt>Comparator</tt> interface for a precise definition of <i>consistent with equals</i>.)  This is so because the <tt>Set</tt> interface is defined in terms of the <tt>equals</tt> operation, but a sorted set performs all element comparisons using its <tt>compareTo</tt> (or <tt>compare</tt>) method, so two elements that are deemed equal by this method are, from the standpoint of the sorted set, equal.  The behavior of a sorted set <i>is</i> well-defined even if its ordering is inconsistent with equals; it just fails to obey the general contract of the <tt>Set</tt> interface.

大概解释一下：如果要使 `SortedSet` 正确表现出与普通的 `Set` 相同的行为，那么它内部元素的顺序关系必须要「与 equals 一致（consistent with equals）」。这是因为 `Set` 使用 `equals` 方法判断元素的等同性，而 `SortedSet` 使用的是 `compareTo` 方法，即如果 `compareTo` 方法返回 0，`SortedSet` 就认为这两个元素是相等的。当 `compareTo` 与 `equals` 的一致性不能满足时，`SortedSet` 的行为就会违背 `Set` 接口的通用约定。

那么，什么叫「与 equals 一致（consistent with equals）」呢，`Comparable` 接口的 JavaDoc 里面有明确的定义。对于任意非空变量 x 和 y，满足 `(x.compareTo(y)==0) == (x.equals(y))`，即认为 `compareTo` 与 `equals` 一致。任何实现了 `Comparable`，但是并没有满足这个条件的类，都应该在自己的文档中明确注明这一点。

> It is strongly recommended, but <i>not</i> strictly required that <tt>(x.compareTo(y)==0) == (x.equals(y))</tt>.  Generally speaking, any class that implements the <tt>Comparable</tt> interface and violates this condition should clearly indicate this fact.  The recommended language is "Note: this class has a natural ordering that is inconsistent with equals."

然而，`Comparable` 接口对这种一致性的约定也只是「建议」，而不是必须严格执行的规则。当然，这是可以理解的，毕竟在现实世界中，这种不一致也是存在的。就比如我们现在这个业务场景，当我们比较两张扑克牌是否相同，需要同时考虑花色和点数，当我们只是比较它们的大小时，就会忽略它们的花色。因此当 `x.compareTo(y) == 0` 时，`x.equals(y)` 是不确定的。这就是 `compareTo` 与 `equals` 不一致的情况，这种不一致是合理的。

JDK 标准库中也有这种不一致的情况，比如 `BigDecimal` 类。如果你创建一个 `HashSet` 实例，并且添加 `new BigDecimal("1.0")` 和 `new BigDecimal("1.00")`，这个集合就将包含两个元素，因为新增到集合中的两个 `BigDecimal` 实例，通过 `equals` 方法来比较时是不相等的。然而，如果你把 `HashSet` 换成 `TreeSet`，集合中将只包含一个元素，因为这两个实例在使用 `compareTo` 方法来比较时是相等的。

在大部分情况下，如果我们的类并没有遵守这种一致性，一般也没有什么问题。但是如果要把这个类用在有序集合中的时候，可能就需要做一点设计上的权衡。在「德州扑克」这个场景中，我们可以在 `new TreeSet<>()` 的时候，额外提供一个与 `equals` 一致的 `Comparator`，使这个集合能够正确地遵守通用的约定。如果项目中使用到 `SortedSet` 的地方不止这一处，我们也可以妥协，提供一个与 `equals` 一致的 `compareTo` 方法，但是在真正需要比较牌的大小的时候，使用另外的 `compareIgnoreSuit` 方法，比如：

	public class PokerCard implements Comparable<PokerCard> {
		// ...

	    @Override
	    public int compareTo(PokerCard other) {
	        int diff = compareIgnoreSuit(other);
	        if (diff != 0) {
	            return diff;
	        } else {
	            return this.suit.compareTo(other.suit);
	        }
	    }
	
	    public int compareIgnoreSuit(PokerCard other) {
			// because 1(A) is bigger than any other number
	        int thisNum = this.number == 1 ? 14 : this.number;
	        int otherNum = other.number == 1 ? 14 : other.number;
	        return thisNum - otherNum;
	    }
	}

这样改过代码之后，之前的那个测试当然能通过，讨论也已基本结束，但是，我们的思考却不应该止步于此。正如题目所言，我把这个称为一个「坑」，但是在 `SortedSet` 的文档描述中，它却是一个 <i>well-defined feature</i>. 虽然文档中已经有了「免责声明」，但还是有不止一人曾经跳入这个「坑」里面，究其原因，恐怕与 `SortedSet` 继承了 `Set` 脱离不了干系。

继承了一个接口，却不遵守这个接口的约定，这实在让人难以理解。既然 `SortedSet` 无法使用 `equals` 来判断元素的等同性，就应该另立门户，成为一个独立的接口，而不是选择继承 `Set`。根据里氏替换原则(Liskov Substitution Principle LSP)，当我们把程序中的 `Set` 替换成其子接口 `SortedSet` 时，程序还应该能正常工作，`SortedSet` 并不能做到这一点，这正是其继承了 `Set`，却没有遵守 `Set` 的契约导致的。当然，标准库的设计者作出这个决策，应该也是权衡了利弊的结果，毕竟，直接继承 `Set` 可以方便地进行向上转型，方便使用者对 `SortedSet` 和其他的 `Set` 进行统一的处理。然而，如果我们把 `SortedSet` 独立为一个接口，也可以提供一个 `asSet` 视图方法，方便使用者在需要的时候将它视为一个 `Set`。因此我认为，选择让 `SortedSet` 继承 `Set`，是个弊大于利的决策。

以上只是对类库设计的一点拙见，班门弄斧，如果您有不同意见，欢迎讨论。